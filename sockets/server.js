const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const formidable = require('formidable');
const path = require('path');
const PORT = process.PORT || 13257;
const showPort = () => `listening on *:${PORT}`;
let users = [];
const chats = [];
let who = null;
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

// Generamos un nuevo color
const hex = () => (Math.floor(Math.random() * 130) + 125).toString(16);
const newColor = () => `#${hex()}${hex()}${hex()}`;

// Para servir los ficheros de la carpeta 'public'
app.use(express.static(`${__dirname}/public`));

// Endpoint para la subida de ficheros
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

// Realizamos la conexión y validación del usuario
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

// Realizamos la desconexión del usuario y su borrado
const closeConnection = socket => {
  users = [...users.filter(item => item.idUser !== socket.id)];
  io.emit('registered-user', users);
};

// Mostramos mensaje informando del usuario que esta escribiendo actualmente
const writeClient = payload => {
  const { data } = payload;
  io.emit('client-been-writing', data ? `El usuario ${data} esta escribiendo...` : '');
};

// Informamos quien esta subido
const whoUpload = payload => {
  who = payload.idUser;
};

// Gestión mensajes en el chat general
const messageChat = (payload, color, type) => {
  const newData = {...payload, color};
  chats.push(newData);
  if (type === 'private') {
    io.to(payload.idDestino).emit('recive-message', newData);
  } else {
    io.emit('recive-message', newData);
  }
};

// Evento que se dispara cunado se realiza la conexión
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