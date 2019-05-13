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

// function newLine() {
//     return function (_target: any, _propertyKey: string | symbol, descriptor: PropertyDescriptor) {
//         var originalMethod = descriptor.value;
//         descriptor.value = function() {
//             return '\n'+originalMethod.apply(this, arguments);
//         };
//         return descriptor;
//     }
// }

// Indent text in new Line
export function indent() {
    return function (_target: any, _propertyKey: string | symbol, descriptor: PropertyDescriptor) {
        var originalMethod = descriptor.value;
        descriptor.value = function() {
            let indenter = Indenter.getInstance();
            indenter.indent();
            let result = '\n' + indenter.mrg + originalMethod.apply(this, arguments);
            indenter.unindent();        
            return result
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

