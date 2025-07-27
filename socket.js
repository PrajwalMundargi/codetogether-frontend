import { io } from 'socket.io-client';
const socket = io('https://codetogether-backend-tr5r.onrender.com',{
    transports: ['websocket'],
    withCredentials: true,
})
export default socket;
