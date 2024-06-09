import Axios, { AxiosInstance } from "axios"
import { ContainerApiFactory, ExecApiFactory, ImageApiFactory } from "./api"

export enum Platform {
   win_x64 = "windows-x64",
   linux_x64 = "linux-x64",
}

export class DockerHost {
   ContainerApi: ReturnType<typeof ContainerApiFactory>
   ImageApi: ReturnType<typeof ImageApiFactory>
   ExecApi: ReturnType<typeof ExecApiFactory>
   constructor(
      readonly name: string,
      readonly platform: Platform,
      readonly socket: AxiosInstance,
   ) {
      this.ContainerApi = ContainerApiFactory(undefined, undefined, this.socket)
      this.ImageApi = ImageApiFactory(undefined, undefined, this.socket)
      this.ExecApi = ExecApiFactory(undefined, undefined, this.socket)
   }
}

export function get_default_host() {
   const socket = Axios.create({
      baseURL: 'http://localhost',
      socketPath: "\\\\.\\pipe\\docker_engine",
      headers: { 'Content-Type': 'application/json' },
   })
   return new DockerHost("default", Platform.win_x64, socket)
}
