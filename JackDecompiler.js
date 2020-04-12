class JackDecompiler {

    main(name, text) {
        this.basename = name;
        this.jumpAddress = 0;
        this.currentLine = 0;
        this.fields = [];
        this.statics = [];
        this.body = [];
        this.resetFunction();
        const lines = this.getLines(text);
        this.translateLines(lines);
        return this.body.join('\n');
    }

    getLines(text) {
        // TODO: remove inline comments
        return text.split('\n')
            .map(s => s.replace(/\/\/.*$/g, '')) // remove line comments
            .map(s => s.replace(/ +/g, ' ')) // remove repeated spaces
            .map(s => s.trim());
    }

    parseCommand(line, lineNum) {
        const parts = line.split(' ');
        if (parts.length < 1) {
            this.dumpState('Empty command on line ' + lineNum);
        } else if (parts[0] == 'push' || parts[0] == 'pop' || parts[0] == 'call' || parts[0] == 'function') {
            if (parts.length != 3) {
                this.dumpState('Missing argument for ' + parts[0] + ' on line ' + lineNum + ' (expected 2)');
            }
        } else if (parts[0] == 'label' || parts[0] == 'goto' || parts[0] == 'if-goto') {
            if (parts.length != 2) {
                this.dumpState('Missing argument for ' + parts[0] + ' on line ' + lineNum + ' (expected 1)');
            }
        } else if (parts.length != 1) {
            this.dumpState('Too many argument for ' + parts[0] + ' on line ' + lineNum + ' (expected none)');
        }
        return {cmd: parts[0], arg1: parts[1], arg2: parseInt(parts[2], 10)};
    }

    translateLines(lines) {
        lines.forEach((line, i) => {
            this.currentLine = i + 1;
            if (line.length > 0) {
                const parsed = this.parseCommand(line, this.currentLine);

                if (!(parsed.cmd == 'pop' && parsed.arg1 == 'pointer') && this.maybeDoStatement) {
                    this.pushCode('do ' + this.temp[0] + ';');
                    this.temp[0] = undefined;
                }
                this.maybeDoStatement = false;
        
                switch (parsed.cmd) {
                    case 'push':
                        this.codePush(parsed.arg1, parsed.arg2);
                        break;
                    case 'pop':
                         this.codePop(parsed.arg1, parsed.arg2);
                         break;
                    case 'add':
                        this.codeAdd();
                        break;
                    case 'sub':
                        this.codeSub();
                        break;
                    case 'neg':
                        this.codeNeg();
                        break;
                    case 'and':
                        this.codeAnd();
                        break;
                    case 'or':
                        this.codeOr();
                        break;
                    case 'not':
                        this.codeNot();
                        break;
                    case 'eq':
                        this.codeEq();
                        break;
                    case 'gt':
                        this.codeGt();
                        break;
                    case 'lt':
                        this.codeLt();
                        break;
                    case 'label':
                         this.codeLabel(parsed.arg1);
                         break;
                    case 'goto':
                        this.codeGoto(parsed.arg1);
                        break;
                    case 'if-goto':
                        this.codeIf(parsed.arg1);
                        break;
                    case 'call':
                        this.codeCall(parsed.arg1, parsed.arg2);
                        break;
                    case 'function':
                        this.codeFunction(parsed.arg1, parsed.arg2);
                        break;
                    case 'return':
                        this.codeReturn();
                        break;
                    default:
                        this.dumpState('Invalid command "' + parsed.cmd + '" on line ' + this.currentLine);
                }
            }
        });

        this.produceFunction();

        const classHead = [];
        classHead.push('class ' + this.basename + ' {');
        classHead.push('');
        if (this.statics.length > 0) {
            classHead.push(this.formatDeclarations('    static ', this.statics));
            classHead.push('');
        }
        if (this.fields.length > 0) {
            classHead.push(this.formatDeclarations('    field ', this.fields));
            classHead.push('');
        }
        Array.prototype.unshift.apply(this.body, classHead);
        this.body.push('}');
    }

    pushCode(code) {
        if (code.startsWith('}')) {
            this.indent--;
        }
        this.code.push(this.getIndent() + code);
        if (code.endsWith('{')) {
            this.indent++;
        }
    }

    getIndent() {
        let ident = '';
        for (let i = 0; i < this.indent; i++) {
            ident += '    ';
        }
        return ident;
    }

    pushElem(elem) {
        this.stack.push(elem);
    }

    popElem() {
        if (this.stack.length == 0) {
            this.dumpState("Stack is empty!");
        }
        return this.stack.pop();
    }

    codePush(segment, i) {
        if (isNaN(i)) {
            this.dumpState('Invalid number on push ' + segment + ' on line ' + this.currentLine);
        }
        switch(segment) {
            case 'local': 
                this.pushElem('v' + i); 
                break;
            case 'argument': 
                if (!this.args[i]) {
                    this.args[i] = {type: 'int', name: 'a' + i};
                }
                this.pushElem('a' + i);
                break;
            case 'this': 
                if (this.fields[i] == undefined) {
                    this.fields[i] = {type: 'int', name: 'field' + i};
                }
                this.pushElem('field' + i); 
                break;
            case 'that': 
                this.pushElem(this.codeThat());
                break;
            case 'constant': 
                this.pushElem(i); 
                break;
            case 'static': 
                this.statics[i] = {type: 'int', name: 'static' + i};
                this.pushElem('static' + i); 
                break;
            case 'temp':
                if (this.temp[i] != undefined) {
                    this.pushElem(this.temp[i]);
                    this.temp[i] = undefined;
                } else {
                    this.dumpState('Invalid use of temp ' + i);
                }
                break;
            case 'pointer': 
                this.pushElem([this.curThis, this.curThat][i]); // ???
                break;
            default:
                this.dumpState('Invalid push segment ' + segment + ' on line ' + this.currentLine);
        }
    }

    codePop(segment, i) {
        if (isNaN(i)) {
            this.dumpState('Invalid number on push ' + segment  + ' on line ' + this.currentLine);
        }
        let rhs;
        switch(segment) {
            case 'local':
                rhs = this.getTerm(this.stack.pop(), false);
                if (rhs == 'true' || rhs == 'false') { this.updateType('v' + i, 'boolean'); }
                this.pushCode('let v' + i + ' = ' + rhs + ';');
                break;
            case 'argument':
                rhs = this.getTerm(this.stack.pop(), false);
                if (rhs == 'true' || rhs == 'false') { this.updateType('a' + i, 'boolean'); }
                this.pushCode('let a' + i + ' = ' + rhs + ';');
                break;
            case 'this':
                rhs = this.getTerm(this.stack.pop(), false);
                if (rhs == 'true' || rhs == 'false') { this.updateType('field' + i, 'boolean'); }
                this.pushCode('let field' + i + ' = ' + rhs + ';');
                break;
            case 'that':
                rhs = this.getTerm(this.stack.pop(), false);
                this.pushCode('let ' + this.codeThat() + ' = ' + rhs + ';');
                break;
            case 'static':
                rhs = this.getTerm(this.stack.pop(), false);
                if (rhs == 'true' || rhs == 'false') { this.updateType('static' + i, 'boolean'); }
                this.pushCode('let static' + i + ' = ' + rhs + ';');
                break;
            case 'temp':
                const expr = this.stack.pop();
                if (i == 0 && /[A-Za-z0-9\.]+\(.*\)/.test(expr)) {
                    // this can be a "do" statement or an array assignment
                    // need to look at next statement to be sure
                    this.maybeDoStatement = true;
                }
                this.temp[i] = expr;
                break;
            case 'pointer':
                this.codePointer(i);
                break;
            default:
                this.dumpState('Invalid pop segment ' + segment + ' on line ' + this.currentLine);
            }
    }

    codePointer(i) {
        if (i == 0) {
            if (this.curThis) {
                this.dumpState("not implemented codePointer curThis: " + this.curThis);
            } else {
                const expr = this.stack.pop();
                if (expr.startsWith('Memory.alloc')) {
                    this.fnKind = 'constructor';
                    this.curThis = 'this';
                } else {
                    this.fnKind = 'method';
                    this.curThis = expr;
                    this.args[0] = {type: this.basename, name: this.curThis};    
                }
            }
        } else {
            this.curThat = this.stack.pop();
        }
    }

    codeThat() {
        const thatExpr = /(.+) \+ (.+)/;
        if (thatExpr.test(this.curThat)) {
            const varName = this.curThat.replace(thatExpr, '$2');
            this.updateType(varName, 'Array');
            return this.curThat.replace(thatExpr, '$2[$1]');
        } else {
            this.dumpState("codeThat -> " + this.curThat);
        }
    }

    updateType(name, type) {
        for (let i = 0; i < this.vars.length; i++) {
            if (this.vars[i] && this.vars[i].name == name) {
                this.vars[i].type = type;
                return;
            }
        }
        for (let i = 0; i < this.args.length; i++) {
            if (this.args[i] && this.args[i].name == name) {
                this.args[i].type = type;
                return;
            }
        }
        for (let i = 0; i < this.fields.length; i++) {
            if (this.fields[i] && this.fields[i].name == name) {
                this.fields[i].type = type;
                return;
            }
        }
        for (let i = 0; i < this.statics.length; i++) {
            if (this.statics[i] && this.statics[i].name == name) {
                this.statics[i].type = type;
                return;
            }
        }
    }

    codeAdd() {
        return this.codeBinaryOp('+');
    }

    codeSub() {
        return this.codeBinaryOp('-');
    }

    codeNeg() {
        return this.codeUnaryOp('-');
    }

    codeAnd() {
        return this.codeBinaryOp('&');
    }

    codeOr() {
        return this.codeBinaryOp('|');
    }

    codeNot() {
        return this.codeUnaryOp('~');
    }

    codeEq() {
        return this.codeBinaryOp('=');
    }

    codeGt() {
        return this.codeBinaryOp('>');
    }

    codeLt() {
        return this.codeBinaryOp('<');
    }

    codeBinaryOp(op) {
        let a = this.getTerm(this.stack.pop(), true);
        let b = this.getTerm(this.stack.pop(), true);
        this.pushElem(b + ' ' + op + ' ' + a);
    }

    codeUnaryOp(op) {
        const a = this.getTerm(this.stack.pop(), true);
        this.pushElem(op + a);
    }

    getTerm(expr, parens) {
        if (this.curThis == expr) {
            return 'this';
        }
        if (expr == '~0') {
            return 'true';
        }
        const parts = expr.toString().split(' ');
        if (parts.length > 1 && parens) {
            return '(' + expr + ')';
        }
        return expr;
    }

    dumpState(msg) {
        console.dir({
            code: this.code, 
            stack: this.stack,
            temp: this.temp,
            curThis: this.curThis,
            curThat: this.curThat
        });
        throw new Error(msg);
    }

    notTerm(expr) {
        if (expr == '~~0') {
            return 'true';
        }
        if (expr == '~0') {
            return 'false';
        }
        if (expr.startsWith('~')) {
            return expr.slice(1);
        }
        return '~' + expr;
    }

    pushIf(label) {
        if (label.startsWith('IF_TRUE')) {
            this.ifStack.push({trueLabel: label, falseLabel: null, endLabel: null});
        } else if (label.startsWith('IF_FALSE')) {
            this.ifStack[this.ifStack.length - 1].falseLabel = label;
        } else if (label.startsWith('IF_END')) {
            this.ifStack[this.ifStack.length - 1].endLabel = label;
        }
    }

    checkElse() {
        return this.ifStack[this.ifStack.length - 1].endLabel != null;
    }

    codeIf(label) {
        const expr = this.stack.pop();
        if (label.startsWith('WHILE_END')) {
            this.pushCode('while (' + this.notTerm(expr) + ') {');
        } else if (label.startsWith('IF_TRUE')) {
            this.pushCode('if (' + expr + ') {');
            this.pushIf(label);
        } else {
            this.dumpState('codeIf - not implemented label prefix: ' + label);
        }
    }

    codeGoto(label) {
        if (label.startsWith('WHILE_EXP')) {
            // end of goto block
        } else if (label.startsWith('WHILE_END')) {
            // no code
        } else if (label.startsWith('IF_FALSE')) {
            this.pushIf(label);
        } else if (label.startsWith('IF_END')) {
            this.pushIf(label);
        } else {
            this.dumpState('codeGoto - not implemented label prefix: ' + label);
        }
    }

    codeLabel(label) {
        if (label.startsWith('WHILE_END')) {
            this.pushCode('}');
        } else if (label.startsWith('WHILE_EXP')) {
            // no code
        } else if (label.startsWith('IF_END')) {
            this.pushCode('}');
            this.ifStack.pop();
        } else if (label.startsWith('IF_FALSE')) {
            if (this.checkElse()) {
                this.pushCode('} else {');
            } else {
                this.pushCode('}');
                this.ifStack.pop();
            }
        } else if (label.startsWith('IF_TRUE')) {
            // no code
        } else {
            this.dumpState('codeLabel - not implemented label prefix: ' + label);
        }
    }

    codeCall(fnName, numArgs) {
        const args = [];
        for (let i = 0; i < numArgs; i++) {
            args.push(this.getTerm(this.stack.pop()));
        }
        if (fnName == 'String.appendChar' && numArgs == 2) {
            if (args[1].startsWith('String.new(')) {
                this.pushElem('"' + String.fromCharCode(args[0]) + '"');
                return;
            } else if (args[1].startsWith('"')) {
                this.pushElem('"' + args[1].replace(/"(.*)"/, '$1') + String.fromCharCode(args[0]) + '"');
                return;
            }
        }
        // TODO: detect method call
        if (this.basename != 'Math') { // Within Math class, must use function. Outside can use the operator.
            if (fnName == 'Math.multiply') {
                const a = this.getTerm(args[0], true);
                const b = this.getTerm(args[1], true);
                this.pushElem(b + ' * ' + a);
                return;
            } else if (fnName == 'Math.divide') {
                const a = this.getTerm(args[0], true);
                const b = this.getTerm(args[1], true);
                this.pushElem(b + ' / ' + a);
                return;
            }
        }
        this.pushElem(fnName + '(' + args.reverse().join(', ') + ')');
    }

    codeFunction(fnName, numLocals) {
        this.produceFunction();
        this.fnName = fnName.replace(this.basename + '.', '');
        for (let i = 0; i < numLocals; i++) {
            this.vars.push({type: 'int', name: 'v' + i});
        }
    }

    codeReturn() {
        const retValue = this.getTerm(this.stack.pop());
        if (retValue == 'this') {
            this.fnType = this.basename;
        } else if (this.fnType == 'void' && retValue != 0) {
            this.fnType = 'int'; // TODO: find out real type...
        }
        this.pushCode('return ' + retValue + ';');
    }

    formatDeclarations(prefix, vars) {
        let varDec = '';
        for (let i = 0; i < vars.length; i++) {
            if (i == 0 || vars[i].type != vars[i-1].type) {
                if (i > 0) {
                    varDec += ';\n';
                }
                varDec += prefix + vars[i].type + ' ' + vars[i].name;
            } else {
                varDec += ', ' + vars[i].name;
            }
        }
        return varDec + ';';
    }

    produceFunction() {
        if (this.fnName) {
            if (this.stack.length > 0) {
                this.dumpState("Stack still has unprocessed elements!");
            }
            let argDec = null;
            if (this.curThis && this.fnKind != 'constructor') {
                argDec = this.args.slice(1).map(v => v.type + ' ' + v.name).join(', ');
            } else {
                argDec = this.args.map(v => v.type + ' ' + v.name).join(', ');
            }
            if (this.fnType == 'void') {
                for (let i = 0; i < this.code.length; i++) {
                    this.code[i] = this.code[i].replace('return 0;', 'return;');
                }
            }
            this.body.push('    ' + this.fnKind + ' ' + this.fnType + ' ' + this.fnName + '(' + argDec + ') {');
            if (this.vars.length > 0) {
                this.body.push(this.formatDeclarations('        var ', this.vars));
            }
            this.body.push(this.code.map(s => '        ' + s).join('\n'));
            this.body.push('    }');
            this.body.push('');
        }
        this.resetFunction();
    }

    resetFunction() {
        this.fnName = '';
        this.fnKind = 'function';
        this.fnType = 'void';
        this.args = [];
        this.vars = [];
        this.code = [];
        this.stack = [];
        this.ifStack = [];
        this.temp = [];
        this.curThis = null;
        this.curThat = null;
        this.maybeDoStatement = false;
        this.indent = 0;
    }

};

module.exports = JackDecompiler;