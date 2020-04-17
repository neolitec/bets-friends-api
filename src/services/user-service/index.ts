import { InternalServerError, Unauthorized } from 'http-errors';
import { decode } from 'punycode';
import UserModel from '../../entity/UserModel';
import TokenModel from '../../entity/TokenModel';
import { createToken, decodeToken } from './jwt';
import { encodePassword } from './password';
import { userAlreadyExistsError } from './errors';

export interface UserCreationRequest {
  username: string;
  password: string;
}

export interface User {
  username: string;
}

export class UserService {
  /**
   * Authenticate user.
   * @param username username
   * @param password user password
   */
  public async authenticate(username: string, password: string) {
    const user = await UserModel.findByUsername(username);
    if (!user) throw new Error('Not found');
    if (user.password === encodePassword(password)) {
      // Create token or reuse an existant one.
      let token = (await TokenModel.findByUserId(user)) || new TokenModel();
      token.token = createToken(username);
      token.user = user;
      token = await token.save();
      return {
        token: token.token,
      };
    }
    throw new Unauthorized();
  }

  public getUserByAuthorizationHeader(authorizationHeader: string): User {
    try {
      const [type, value] = authorizationHeader.split(/\s+/);
      if (type.toLowerCase() !== 'bearer') throw new Unauthorized();

      const decodedToken = decodeToken(value.trim());
      if (!decodedToken?.username) {
        throw new Unauthorized();
      }

      return { username: decodedToken.username };
    } catch (err) {
      if (err.code === 'ERR_JWS_VERIFICATION_FAILED') {
        throw new Unauthorized();
      } else {
        throw new InternalServerError();
      }
    }
  }

  public async createUser({
    username,
    password,
  }: UserCreationRequest): Promise<UserModel> {
    const existingUser = await UserModel.findByUsername(username);
    if (existingUser) {
      throw userAlreadyExistsError;
    }

    const user = new UserModel();
    user.username = username;
    user.setPassword(password);
    return user.save();
  }
}

export const userService = new UserService();
