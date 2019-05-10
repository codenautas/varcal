export class Indenter {

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
function ident() {
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

//     getTxt() {
//         return `text without trailing spaces:`+
//                     this.childTxt()+
//                     this.anotherChildTxt()
//     }
//     @newLine()
//     @ident()
//     childTxt(): string{
//         return 'child txt'+this.anotherChildTxt();
//     }
//     @newLine()
//     @ident()
//     anotherChildTxt(): string{
//         return 'another child txt';
//     }
// }
// let tom = new Horse("Tommy the Palomino");
// console.log('aa'+tom.getTxt());
// console.log('aa'+tom.getTxt());
// console.log('aa'+tom.getTxt());
