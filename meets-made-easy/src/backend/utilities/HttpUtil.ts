import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class HttpUtil {
  constructor(private readonly httpService: HttpService) {}

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response: AxiosResponse<T> = await firstValueFrom(
        this.httpService.get<T>(url, config),
      );
      return response.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async post<T>(
    url: string,
    data: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    try {
      const response: AxiosResponse<T> = await firstValueFrom(
        this.httpService.post<T>(url, data, config),
      );
      return response.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  private handleError(error: any): never {
    if (error.response) {
      throw new HttpException(
        error.response.data || 'HTTP REQUEST FAILED',
        error.response.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    throw new HttpException(
      error.message || 'UNKNOWN HTTP ERROR',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
