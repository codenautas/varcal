export class Indenter {

    static instance:Indenter;
    public mrg: string = '';

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



class Animal {
    constructor(public name: string) { }
    move(distanceInMeters: number = 0) {
        console.log(`${this.name} moved ${distanceInMeters}m.`);
    }
}

// class Snake extends Animal {
//     constructor(name: string) { super(name); }
//     move(distanceInMeters = 5) {
//         console.log("Slithering...");
//         super.move(distanceInMeters);
//     }
// }

class Horse extends Animal {

    @prueba()
    move(distanceInMeters = 45) {
        console.log("Galloping...");
        super.move(distanceInMeters);
    }
}

function prueba() {
    return function (_target: any, _propertyKey: string | symbol, descriptor: PropertyDescriptor) {
        var originalMethod = descriptor.value;
        descriptor.value = function() {
            console.log('antes');
            originalMethod.apply(this, arguments);
            console.log('despues');
        };
        return descriptor;
    }
}

// let sam = new Snake("Sammy the Python");
let tom: Animal = new Horse("Tommy the Palomino");

// sam.move();
tom.move(34);

