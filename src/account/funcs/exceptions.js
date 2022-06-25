export class BaseException {
  static message = `Unknown error. Try again.`;
  
  
  static handle() {
    throw new BaseException();
  }
}

export class LoginException extends BaseException {
  static message = `Recheck your phone and password and try again.`;
}

export class AddException extends BaseException {
  static message = `Do you have enough minutes or gigabytes?`;
}

export class DeleteException extends BaseException {
}

export class InternetException extends BaseException {
  static message = `Check your internet connection`;
}

