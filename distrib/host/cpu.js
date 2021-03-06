///<reference path="../globals.ts" />
///<reference path="../host/control.ts" />
///<reference path="../os/interrupt.ts" />
/* ------------
     CPU.ts

     Requires global.ts.

     Routines for the host CPU simulation, NOT for the OS itself.
     In this manner, it's A LITTLE BIT like a hypervisor,
     in that the Document environment inside a browser is the "bare metal" (so to speak) for which we write code
     that hosts our client OS. But that analogy only goes so far, and the lines are blurred, because we are using
     TypeScript/JavaScript in both the host and client environments.

     This code references page numbers in the text book:
     Operating System Concepts 8th edition by Silberschatz, Galvin, and Gagne.  ISBN 978-0-470-12872-5
     ------------ */
var TSOS;
(function (TSOS) {
    var Cpu = (function () {
        function Cpu(PC, Acc, Operation, Xreg, Yreg, Zflag, isExecuting, thisPCB) {
            if (PC === void 0) { PC = 0; }
            if (Acc === void 0) { Acc = 0; }
            if (Operation === void 0) { Operation = ""; }
            if (Xreg === void 0) { Xreg = 0; }
            if (Yreg === void 0) { Yreg = 0; }
            if (Zflag === void 0) { Zflag = 0; }
            if (isExecuting === void 0) { isExecuting = false; }
            if (thisPCB === void 0) { thisPCB = null; }
            this.PC = PC;
            this.Acc = Acc;
            this.Operation = Operation;
            this.Xreg = Xreg;
            this.Yreg = Yreg;
            this.Zflag = Zflag;
            this.isExecuting = isExecuting;
            this.thisPCB = thisPCB;
        }
        Cpu.prototype.init = function () {
            this.PC = 0;
            this.Acc = 0;
            this.Xreg = 0;
            this.Yreg = 0;
            this.Zflag = 0;
            this.isExecuting = false;
            this.thisPCB = null;
        };
        Cpu.prototype.cycle = function () {
            _Kernel.krnTrace('CPU cycle');
            if (this.isExecuting) {
                if (this.thisPCB == null) {
                    _KernelInterruptQueue.enqueue(new TSOS.Interrupt(SCHEDULER_INIT_IRQ, 0));
                    if (this.thisPCB != null) {
                        this.PC = this.thisPCB.base;
                        this.Acc = 0;
                        this.Xreg = 0;
                        this.Yreg = 0;
                        this.Zflag = 0;
                        TSOS.Control.runPCBTbl();
                    }
                }
                this.execCpuCycle();
                //_Kernel.krnTrace("PCB: "+this.thisPCB.PiD /* b,l,pc*/);
                //update tables while program is executing
                TSOS.Control.initCPUTbl();
                TSOS.Control.editMemoryTbl();
            }
        };
        Cpu.prototype.execCpuCycle = function () {
            //switch case for each opcode
            var command;
            var i;
            var str;
            var x;
            var y;
            var z;
            var hold;
            command = _Memory.mem[this.PC];
            if (_Scheduler.tab < _Scheduler.quantum) {
                switch (command) {
                    case "00":
                    case "0":
                        this.Operation = "00"; // Break or sys call
                        //check ready queue
                        if (_ReadyQ.isEmpty() == false) {
                            this.thisPCB.state = "Complete";
                            this.thisPCB.PC = this.PC;
                            this.thisPCB.Acc = this.Acc;
                            this.thisPCB.Xreg = this.Xreg;
                            this.thisPCB.Yreg = this.Yreg;
                            this.thisPCB.Zflag = this.Zflag;
                            TSOS.Control.runPCBTbl();
                            _KernelInterruptQueue.enqueue(new TSOS.Interrupt(CPU_REPLACE_IRQ, 0));
                        }
                        else {
                            //end running program
                            this.killProcess();
                        }
                        break;
                    case "A9":
                        this.Operation = "A9"; //load accumulator with a constant
                        this.PC++;
                        this.Acc = parseInt(_Memory.mem[this.PC], 16);
                        this.PC++;
                        break;
                    case "AD":
                        this.Operation = "AD"; //load the accumulator from memory
                        i = this.atMemory();
                        this.Acc = parseInt(_Memory.mem[i], 16);
                        this.PC++;
                        break;
                    case "8D":
                        this.Operation = "8D"; //store the acc in memory   //test prog: A9 03 8D 41 00 A9 01 8D 40 00 AC 40 00 A2 01 FF EE 40 00 AE 40 00 EC 41 00 D0 EF A9 44 8D 42 00 A9 4F 8D 43 00 A9 4E 8D 44 00 A9 45 8D 45 00 A9 00 8D 46 00 A2 02 A0 42 FF 00
                        i = this.atMemory();
                        hold = this.Acc.toString(16);
                        if (hold.length < 2) {
                            hold = "0" + hold;
                        }
                        _Memory.mem[i] = hold;
                        _Kernel.krnTrace("Storing " + hold + " to memory");
                        this.PC++;
                        break;
                    case "6D":
                        this.Operation = "6D"; //Add with carry
                        i = this.atMemory();
                        x = this.parseConst(_Memory.mem[i]);
                        y = this.Acc;
                        z = x + y;
                        this.Acc = z;
                        this.PC++;
                        break;
                    case "A2":
                        this.Operation = "A2"; //load X Register with constant
                        this.PC++;
                        this.Xreg = parseInt(_Memory.mem[this.PC], 16);
                        this.PC++;
                        break;
                    case "AE":
                        this.Operation = "AE"; //load X register from memory
                        i = this.atMemory();
                        this.Xreg = parseInt(_Memory.mem[i], 16);
                        this.PC++;
                        break;
                    case "A0":
                        this.Operation = "A0"; //Load Y register with constant
                        this.PC++;
                        this.Yreg = parseInt(_Memory.mem[this.PC], 16);
                        this.PC++;
                        break;
                    case "AC":
                        this.Operation = "AC"; //Load Y register from memory
                        i = this.atMemory();
                        this.Yreg = parseInt(_Memory.mem[i], 16);
                        this.PC++;
                        break;
                    case "EA":
                        this.Operation = "EA"; //no operation
                        this.PC++;
                        break;
                    case "EC":
                        this.Operation = "EC"; //Compare a byte in memory to the x Register (if equal, sets ZFlag)
                        i = this.atMemory();
                        x = this.parseConst(_Memory.mem[i]);
                        y = this.Xreg;
                        if (x == y) {
                            this.Zflag = 1;
                        }
                        else {
                            this.Zflag = 0;
                        }
                        this.PC++;
                        break;
                    case "D0":
                        this.Operation = "D0"; // Branch n bytes if Z flag = 0
                        ++this.PC;
                        var branch = this.PC + this.parseConst(_Memory.mem[this.PC]);
                        if (this.Zflag == 0) {
                            this.PC = branch + 1;
                            if (this.PC > 255 + this.thisPCB.base) {
                                this.PC -= 256;
                            }
                        }
                        else {
                            this.PC++;
                        }
                        break;
                    case "EE":
                        this.Operation = "EE"; // Increment value of a byte
                        i = this.atMemory();
                        x = parseInt(_Memory.mem[i], 16);
                        x = x + 1;
                        hold = x.toString(16);
                        if (hold.length < 2) {
                            hold = "0" + hold;
                        }
                        _Memory.mem[i] = hold;
                        this.PC++;
                        break;
                    case "FF":
                        this.Operation = "FF"; //System call: print integer to X Register which is stored in the Y register OR print the 00 terminated string stored at the address to the Y Reg
                        if (this.Xreg == 1) {
                            _StdOut.putText(this.Yreg.toString());
                            this.PC++;
                        }
                        else if (this.Xreg == 2) {
                            i = this.Yreg + this.thisPCB.base;
                            //z = parseInt("00");
                            while (_Memory.mem[i] != "00") {
                                str = String.fromCharCode(parseInt(_Memory.mem[i], 16));
                                _StdOut.putText(str);
                                i++;
                            }
                            this.PC++;
                        }
                        else {
                            _StdOut.putText("invalid value in xreg");
                            this.isExecuting = false;
                        }
                        break;
                    default:
                        this.isExecuting = false;
                        _StdOut.putText("Invalid operation:" + _Memory.mem[this.PC]);
                }
                if (_Scheduler.scheduler == "rr") {
                    _Scheduler.tab++;
                }
            }
            else {
                this.updatePCB();
            }
        };
        Cpu.prototype.atMemory = function () {
            var memSlot;
            this.PC++;
            var m1 = _Memory.mem[this.PC];
            this.PC++;
            var m2 = _Memory.mem[this.PC];
            var memAdd = m2.concat(m1);
            memSlot = _CPU.thisPCB.base + parseInt(memAdd, 16);
            if (memSlot >= _CPU.thisPCB.base && memSlot < _CPU.thisPCB.limit) {
                return memSlot;
            }
            else {
                _StdOut.putText("Memory index" + memSlot + "is out of bounds");
                _StdOut.advanceLine();
                _OsShell.shellKill(_CPU.thisPCB.PiD);
            }
        };
        Cpu.prototype.parseConst = function (num) {
            var x = parseInt(num, 16);
            return x;
        };
        Cpu.prototype.updatePCB = function () {
            this.thisPCB.state = "waiting";
            this.thisPCB.PC = this.PC;
            this.thisPCB.Acc = this.Acc;
            this.thisPCB.Xreg = this.Xreg;
            this.thisPCB.Yreg = this.Yreg;
            this.thisPCB.Zflag = this.Zflag;
            _KernelInterruptQueue.enqueue(new TSOS.Interrupt(CPU_PROCESS_CHANGE_IRQ, 0));
        };
        Cpu.prototype.killProcess = function () {
            this.isExecuting = false;
            this.thisPCB.state = "Terminated";
            this.thisPCB.PC = this.PC;
            this.thisPCB.Acc = this.Acc;
            this.thisPCB.Xreg = this.Xreg;
            this.thisPCB.Yreg = this.Yreg;
            this.thisPCB.Zflag = this.Zflag;
            TSOS.Control.runPCBTbl();
            _krnFSDriver.delete(this.thisPCB.PiD);
            this.init();
            //_Kernel.krnTrace("Terminate Resident List");
            for (var x = 0; x < _ResList.getSize(); x++) {
                _Kernel.krnTrace("pID: " + _ResList[x].pid + " located in: " + _ResList[x].locality);
            }
            _StdOut.advanceLine();
            _OsShell.putPrompt();
        };
        return Cpu;
    })();
    TSOS.Cpu = Cpu;
})(TSOS || (TSOS = {}));
/*lab 3 Questions

1. Explain the difference between internal and external fragmentation.


2. Given five(5) memory partitions of 100KB, 500KB, 200KB, 300KB, and 600KB (in that order),how would
optimal, first-fit, best-fit, and worst-fit algorithms place processes of 212KB, 417KB, 112KB, and
426KB (in that order)?

first-fit: 212KB  -- 500KB partition
           112KB  -- 200KB partition
           417KB  -- 600KB Partition
           426KB  -- Cannot be allocated in this example

Best-fit:  212KB  -- 300KB Partition
           112KB  -- 200KB partition
           417KB  -- 500KB Partition
           426KB  -- 600KB Partition

Worst-fit: 212KB  -- 600KB partition
           112KB  -- 300KB partition
           417KB  -- 500KB Partition
           426KB  -- Cannot be allocated in this example

 lab 4 Questions

1. What is the relationship between a guest operating system and a host operating system
  in a system like VMware? What factors need to be considered in choosing the host operating system?




 */ 
