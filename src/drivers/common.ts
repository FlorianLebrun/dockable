import axios from 'axios'
import Https from 'node:https'

export const agent = axios.create({
   httpsAgent: new Https.Agent({
      rejectUnauthorized: false
   })
})
