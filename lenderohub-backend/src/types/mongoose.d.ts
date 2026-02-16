// src/types/mongoose.d.ts
import 'mongoose';

declare module 'mongoose' {
  namespace Schema {
    namespace Types {
      class Money extends SchemaType {}
    }
  }
  
  interface Document {
    getMoney?(field: string): any;
    setMoney?(field: string, value: any): void;
  }
}
// Add QueryFilter as alias for FilterQuery
declare module 'mongoose' {
  export type QueryFilter<T> = FilterQuery<T>
}
