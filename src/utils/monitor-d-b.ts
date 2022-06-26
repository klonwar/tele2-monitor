export interface MonitorDBInterface {
  source: string,
  amount: number,
  price: number,

  headless?: boolean;
  phone?: string;
}



export class MonitorDB implements MonitorDBInterface {
  source: string;
  amount: number;
  price: number;

  headless?: boolean;
  phone?: string;

  static validate(obj: any): obj is MonitorDBInterface {
    return !(
      obj.source === undefined ||
      obj.amount === undefined ||
      obj.price === undefined
    );
  }
}