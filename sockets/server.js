/**
 * @URL {get} http://tecnops.es:13257/
 * cmd: node ./sockets/server.js
 */
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const formidable = require('formidable');
const path = require('path');
const PORT = process.PORT || 13257;

/** 
 * @description Muestra el puerto donde se ha iniciado la aplicación
 */
const showPort = () => `listening on *:${PORT}`;

// Definición de constantes y variables para la gestión del chat
let users = [];
let who = null;
const chats = [];
const MAX_FILE_SIZE_MB = 0.3;
const MAX_FILE_LENGTH = 17;
const MIME_TYPE = [
  'image/gif',
  'image/jpeg',
  'image/png'
];
const LITERAL = {
  fileNotAllowed: `El fichero que intenta subir no esta permitido. Los tipos permitidos son los siguientes: <b>[${MIME_TYPE.join(', ')}]</b>`,
  maxSize: `El fichero no puede tener un tamaño superior a <b>${MAX_FILE_SIZE_MB} MB</b> y/o no debe exceder de <b>${MAX_FILE_LENGTH}</b> caracteres`,
};

/** 
 * @description Nos devuelve un valor hexadecimal para generar colores aleatorios
 * @return {number} Valor decimal del color
 */
const hex = () => (Math.floor(Math.random() * 130) + 125).toString(16);

/** 
 * @description Nos devuelve el color hexadecimal completo (RGB)
 * @return {string}
 */
const newColor = () => `#${hex()}${hex()}${hex()}`;

// Para servir los ficheros de la carpeta 'public'
app.use(express.static(`${__dirname}/public`));

/** 
 * @description Endpoint para la subida de documentos
 */
app.post('/upload-file', (req, res) => {
  let fileName = '';
  let error = true;
  const form = new formidable.IncomingForm({
    maxFileSize: MAX_FILE_SIZE_MB * 1024 * 1024
  });
  form.parse(req);
  form.on('fileBegin',(field, file) => {
    console.log(file, field);
    if (MIME_TYPE.includes(file.type) && file.type.length < 20) {
      file.path = path.join(__dirname, '/public/upload-file', file.name);
      fileName = file.name;
      error = false;
    }
  });	
  form.on('end', () => {
    res.status(error ? 400 : 200).send({
      statusCode: error ? 400 : 200,
      statusMessage: error ? LITERAL.fileNotAllowed : `${req.protocol}://${req.hostname}:${PORT}/upload-file/${fileName}`,
      path: null
    });
  });
  form.on('progress', (bytesReceived, bytesExpected) => {
    io.to(who).emit('upload-progress', { recived: bytesReceived, total: bytesExpected, who });
    console.log(bytesReceived, bytesExpected);
  });
  form.on('error', () => {
    res.status(404).send({ statusCode: 404, statusMessage: LITERAL.maxSize, path: null });
  })
});

/** 
 * @description Método que se dispara cuando realizamos la conexión del usuario. Aquí realizamos la conexión y validación del usuario
 * @param {object} payload Datos del usuario
 * @param {object} El socket generado por el evento que dispara cuando se realiza la conexión
 * @param {string} Color del usuario
 */
const connection = async (payload, socket, color) => {
  const idUser = socket.id;
  const { user } = payload;
  let error = false;
  users.forEach(item => {
    error = item.user === user;
    if (error) return false;
  });
  if (error) {
    io.to(idUser).emit('error-registered-user', { error: `El usuario <b>${user}</b> esta en uso.`});
  } else {
    users.push({ ...payload, idUser, color });
    io.emit('registered-user', users);
  }
};

/** 
 * @description Método que se dispara cuando realizamos la desconexión del usuario (Recargar y nuevo acceso). Aquí realizamos la desconexión
 * @param {object} El socket generado por el evento que dispara cuando se realiza la conexión
 */
const closeConnection = socket => {
  users = [...users.filter(item => item.idUser !== socket.id)];
  io.emit('registered-user', users);
};

/** 
 * @description Método que se dispara cuando escribimos en nuestro chat. Aquí emitimos la información de quien esta escribiendo
 * @param {object} payload Datos del usuario
 */
const writeClient = payload => {
  const { data } = payload;
  io.emit('client-been-writing', data ? `El usuario ${data} esta escribiendo...` : '');
};

/** 
 * @description Método que se dispara cuando subimos un fichero. Aquí almacenamos temporalmente el usuario que esta subiendo un archivo
 * @param {object} payload Datos del usuario
 */
const whoUpload = payload => {
  who = payload.idUser;
};

/** 
 * @description Método que se dispara cuando enviamos un mensaje. Desde aquí gestionamos el envio de mensajes a un usuario privado o al chat público
 * @param {object} payload Datos del usuario
 * @param {string} color Color del usuario
 * @param {string} type Indicamos si es un chat privado o no
 */
const messageChat = (payload, color, type) => {
  const newData = {...payload, color};
  chats.push(newData);
  if (type === 'private') {
    io.to(payload.idDestino).emit('recive-message', newData);
  } else {
    io.emit('recive-message', newData);
  }
};

/** 
 * @description Evento que se dispara cuando se realiza la conexión
 * @param {object} El socket generado por el evento que dispara cuando se realiza la conexión
 */
io.on('connection', socket => {
  let idUser = null;
  const color = newColor();
  socket.on('connected-to-server', payload => connection(payload, socket, color));
  socket.on('disconnect', () => closeConnection(socket));
  socket.on('write-client', writeClient);
  socket.on('message-chat-general', payload => messageChat(payload, color, 'general'));
  socket.on('message-chat-private', payload => messageChat(payload, color, 'private'));
  socket.on('upload-file', payload => whoUpload(payload));
});

// Servidor escuchando
http.listen(PORT, () => {
  console.log(showPort());
});