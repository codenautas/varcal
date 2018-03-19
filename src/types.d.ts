declare module 'discrepances'{
    function showAndThrow(obtained:any, expected:any):void
}

declare module "like-ar"{
    type ObjectWithArrayFunctions={
        forEach:( callback:(value:any, key:string)=>void ) => ObjectWithArrayFunctions
        map    :( callback:(value:any, key:string)=>any  ) => ObjectWithArrayFunctions
    }
    function likeAr(o:object):ObjectWithArrayFunctions
    namespace likeAr{}
    export = likeAr
}

declare module "pg-promise-strict"{
    var easy:boolean
    type ConnectParams={
        motor?:string
        database?:string
        user?:string
        password?:string
        port?:string
    }
    type Client={
        executeSqlScript(fileName:string):Promise<void>
        query(queryString:string, params?:any[]):{
            fetchUniqueValue():Promise<any>
        }
    }
    function connect(opts:ConnectParams):Client
}