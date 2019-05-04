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

class Horse{
    constructor(public name: string) { }

    //@startQuery()
    getTxt() {
        return  `text without trailing spaces: \n`+
                `${this.childTxt()}`
    }
    @ident()
    childTxt() {
        return 'child txt'
    }
}

// function startQuery() {
//     return function (_target: any, _propertyKey: string | symbol, descriptor: PropertyDescriptor) {
//         var originalMethod = descriptor.value;
//         descriptor.value = function() {
//             new Indenter();
//             return originalMethod.apply(this, arguments);
//             new Indenter();
//         };
//         return descriptor;
//     }
// }

function ident() {
    return function (_target: any, _propertyKey: string | symbol, descriptor: PropertyDescriptor) {
        var originalMethod = descriptor.value;
        descriptor.value = function() {
            let indenter = Indenter.getInstance();
            indenter.indent();
            let result = indenter.mrg + originalMethod.apply(this, arguments);
            indenter.unindent();        
            return result
        };
        return descriptor;
    }
}

let tom = new Horse("Tommy the Palomino");
console.log('aa'+tom.getTxt());
console.log('aa'+tom.getTxt());
console.log('aa'+tom.getTxt());
