class Indenter {

    static instance:Indenter;
    public mrg: string = '';

    static getInstance(){
        return Indenter.instance || (Indenter.instance = new Indenter())
    }

    constructor(public indentation: number = 2, public margin: number = 0){
        Indenter.instance = this;
    }

    indent(indentation?:number){
        this.margin += indentation || this.indentation;
        this.setTXTMargin();
    }
    unindent(indentation?:number){
        this.margin -= indentation || this.indentation;
        this.setTXTMargin();
    }
    setTXTMargin() { 
        this.mrg = Array(this.margin + 1).join(' ');
    }
}

// unindent all lines to left
// but just trimming to left as many white spaces as the line with less indentation
export function fullUnIndent() {
    return function (_target: any, _propertyKey: string | symbol, descriptor: PropertyDescriptor) {
        var originalMethod = descriptor.value;
        descriptor.value = function() {
            let result:string = originalMethod.apply(this, arguments);
            if (result){
                const resultLines = result.split('\n').filter(line=>line.trim().length); // removing blank lines
                
                //the min index of the "first non white character" (/\S/) of each line
                const minIndentation = Math.min(...resultLines.map(line=> line.search(/\S/)>-1 ? line.search(/\S/): 0)); 
                result = resultLines.map(line=> new RegExp('^'+Array(minIndentation+1).join(' ')).test(line)
                    ? line.substring(minIndentation): line
                ).join('\n')
            }
            return result
        };
        return descriptor;
    }
}

// Indent text in new Line
export function indent() {
    return function (_target: any, _propertyKey: string | symbol, descriptor: PropertyDescriptor) {
        var originalMethod = descriptor.value;
        descriptor.value = function() {
            let indenter = Indenter.getInstance();
            indenter.indent();
            let result = indenter.mrg + originalMethod.apply(this, arguments);
            indenter.unindent();
            return result;
        };
        return descriptor;
    }
}

// for testing purposes of indenter decorator
// class Horse{
//     constructor(public name: string) { }
//     getTxt(): string{
//         return 'texto 1:'+
//                     this.gettexto2()+
//                     this.gettexto3()+
//                     "\nmi texto"
//     }
//     getTxt2(): string{
//         return `texto 2:
//                     ${this.gettexto2()}
//                     ${this.gettexto3()}
//                     mi texto`
//     }

//     @indent()
//     gettexto2(): string{
//         return 'texto 2'+
//                     this.gettexto3();
//     }

//     @indent()
//     gettexto3(): string{
//         return 'texto 3';
//     }
// }
// let tom = new Horse("Tommy the Palomino");
// console.log(tom.getTxt());
// console.log(tom.getTxt2());

