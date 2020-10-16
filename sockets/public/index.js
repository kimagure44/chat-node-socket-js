// Definición de constantes y variables para la gestión del chat
let socket = null;
let user = null;
let message = null;
let usersPanel = null;
let notification = null;
let uploadFile = null;
let webrtc = null;
const CHAT_GENERAL = 'chatGeneral';
const LENGTH_MIN_USERNAME = 3;
const EMPTY = 0;
const LITERAL = {
  sameUser: 'No puedes enviarte un mensaje a ti mismo',
  minSizeUser: `El nombre del usuario debe tener <b>mínimo ${LENGTH_MIN_USERNAME} caracteres</b>`,
  uploadFile: 'Ha compartido un fichero',
  uploadSuccess: 'El fichero se ha subido y se esta compartiendo correctamente',
};

/** 
 * @description Cierra una sala de chat privada
 * @param {string} selectorID ID de la sala a cerrar
 */
const closeChat = selectorID => {
  document.querySelector(`.tabs ul li[data-content='${selectorID}']`).removeEventListener('click', selectedChat);
  document.querySelector(`.tabs ul li[data-content='${selectorID}']`).remove();
  document.querySelector(`.containerChats #${selectorID}`).remove();
  document.querySelector(`li[data-content='chatGeneral']`).click();
};

/** 
 * @description Creamos una sala privada
 * @param {object} data Información para crear la sala
 */
const chatTo = data => {
  const selectorID = data.idHTML || data.idOrigenHTML;
  const selectorIdUser = data.idUser ||data.idOrigen;
  const selectorUser = data.user || data.userOrigen;
  const existChat = document.querySelectorAll(`#${selectorID}`).length;
  if (existChat === EMPTY) {
    if (user.dataset.idhtml !== selectorID || data.idDestinoHTML !== data.idOrigenHTML) {
      document.querySelectorAll('.tabs ul li').forEach(item => {
        item.children[0].classList.remove('active');
      });
      document.querySelectorAll('.containerChats .chat').forEach(item => {
        item.classList.add('hide');
      });
      const chat = document.createElement('div');
      const li = document.createElement('li');
      const a = document.createElement('a');
      const span = document.createElement('span');
      const iNewChat = document.createElement('i');
      const iCloseChat = document.createElement('i');
      chat.setAttribute('id', selectorID);
      chat.classList.add('chat','textarea', 'contentTab');
      document.querySelector('.containerChats').prepend(chat);
      li.setAttribute('data-content', selectorID.toString());
      li.setAttribute('data-idUser', selectorIdUser.toString());
      a.classList.add('active');
      span.style.color = data.color;
      span.classList.add('has-text-white', 'chatUser');
      span.innerHTML = selectorUser;
      a.appendChild(span);
      iNewChat.classList.add('fas', 'fa-comment', 'newMessage', 'hide');
      a.appendChild(iNewChat);
      iCloseChat.classList.add('fas', 'fa-times-circle', 'closeChat');
      iCloseChat.onclick = () => { closeChat(selectorID.toString()); };
      a.appendChild(iCloseChat);
      li.appendChild(a);
      document.querySelector('.tabs ul').appendChild(li);
      document.querySelector(`.tabs ul li[data-content='${selectorID}']`).addEventListener('click', selectedChat);
    } else {
      notify(LITERAL.sameUser, 'danger');
    }
  }
};

/** 
 * @description Seleccionar una sala para charlar
 * @param {object} evt Evento implicito en la acción ejecutada
 */
const selectedChat = evt => {
  document.querySelectorAll('.containerChats .chat').forEach(item => {
    item.classList.add('hide');
  });
  const showChat = evt.currentTarget.dataset['content'];
  const chatElement = document.querySelector(`#${showChat}`);
  if (chatElement) {
    chatElement.classList.remove('hide');
  }
  document.querySelectorAll('.tabs a').forEach(item => item.classList.remove('active'));
  evt.currentTarget.children[0].classList.add('active');
  if (!Array.from(evt.currentTarget.children[0].querySelector('i').classList).includes('hide')) {
    evt.currentTarget.children[0].querySelector('i').classList.add('hide')
  }
};

/** 
 * @description Envia mensajes al chat general y a un usuario privado
 * @param {object} evt Evento implicito en la acción ejecutada
 * @param {boolean} status Indicamos el estado para saber que usuario esta escribiendo
 */
const sendMessage = (evt, status) => {
  if (evt.key === 'Enter') {
    if (user.value.length >= LENGTH_MIN_USERNAME && message.value.trim().length > EMPTY) {
      const parent = document.querySelectorAll('.tabs a.active')[0].parentElement;
      const content = parent.dataset.content;
      const currentlyChat = document.querySelector(`#${content}`);
      const isChatGeneral = content === CHAT_GENERAL;
      const infoMensaje = {
        idOrigen: user.dataset.iduser,
        idOrigenHTML: user.dataset.idhtml,
        idDestino: isChatGeneral ? CHAT_GENERAL : parent.dataset.iduser,
        idDestinoHTML: content,
        userOrigen: user.value,
        userDestino: isChatGeneral ? CHAT_GENERAL : parent.innerText,
        message: message.value
      };
      if (content !== CHAT_GENERAL) {
        const color = document.querySelector(`#userConnected .chatUser[data-idhtml='${user.dataset.idhtml}']`).style.color;
        const messageSend = document.querySelector(`.containerChats #${content}`);
        const div = document.createElement('div');
        const span = document.createElement('span');
        span.style.color = color;
        span.classList.add('chatUser');
        span.appendChild(document.createTextNode(`${infoMensaje.userOrigen}:`));
        div.appendChild(span);
        div.innerHTML += infoMensaje.message;
        messageSend.appendChild(div);
      }
      socket.emit(`message-chat-${isChatGeneral ? 'general' : 'private'}`, infoMensaje);
      message.value = '';
      currentlyChat.scrollTo(0, currentlyChat.scrollHeight);
    } 
    user.classList[user.value.length >= LENGTH_MIN_USERNAME ? 'remove' : 'add']('has-background-danger');
  } else {
    if (user.value.length >= LENGTH_MIN_USERNAME) {
      if (evt.key !== 'Tab') {
        socket.emit('write-client', { data: status ? user.value : ''});
      }
    }
  }
};

/** 
 * @description Muestra texto indicando quien esta escribiendo
 * @param {object} payload Información que pinta cuando pulsamos un tecla
 */
const clientBeenWriting = payload => {
  document.querySelector('.containerChats .infoInput').innerHTML = payload;
};

/** 
 * @description Muestra texto en el chat general
 * @param {object} data Información relativa al usuario
 */
const reciveMessage = data => {
  const {
    color,
    idDestinoHTML,
    idOrigenHTML,
    userOrigen,
    message 
  } = data;
  let activeChatID = document.querySelector(`#${idDestinoHTML}`) || document.querySelector(`#${idOrigenHTML}`);
  if (!activeChatID) {
    chatTo(data);
    activeChatID = document.querySelector(`#${idDestinoHTML}`) || document.querySelector(`#${idOrigenHTML}`);
  }
  if (idDestinoHTML !== idOrigenHTML) {
    const div = document.createElement('div');
    const span = document.createElement('span');
    span.style.color = color;
    span.classList.add('chatUser');
    span.appendChild(document.createTextNode(`${userOrigen}:`));
    div.appendChild(span);
    div.innerHTML += message;
    activeChatID.appendChild(div);
    activeChatID.scrollTo(0, activeChatID.scrollHeight);
  }
  const newMessage = document.querySelector('.tabs a.active').parentElement.dataset.content
  if (newMessage !== activeChatID.id && newMessage !== idDestinoHTML) {
    const destino = document.querySelector(`.tabs li[data-content='${idDestinoHTML}'] i`);
    const origen = document.querySelector(`.tabs li[data-content='${idOrigenHTML}'] i`);
    (destino || origen).classList.remove('hide');
  }
};

/** 
 * @description Añade y actualiza el panel lateral con el listado de los usuarios
 * @param {object} payload Información de cada uno de los usuarios
 */
const registerUser = payload => {
  Array.from(usersPanel.children).forEach(item => item.remove())
  payload.forEach(item => {
    const div = document.createElement('div');
    div.style.color = item.color;
    div.classList.add('chatUser');
    div.onclick = () => { chatTo(item); };
    div.setAttribute('data-idUser', item.idUser);
    div.setAttribute('data-idHTML', item.idHTML);
    div.appendChild(document.createTextNode(item.user));
    usersPanel.appendChild(div);
    if (user.value === item.user) {
      user.setAttribute('data-idHTML', item.idHTML);
      user.setAttribute('data-idUser', item.idUser);
    }
  });
};

/** 
 * @description Muestra mensaje de error al registrar el usuario
 * @param {object} payload Información de cada uno de los usuarios
 * @param {object} evt Evento implicito en la acción ejecutada
 */
const errorRegisteredUser = (payload, evt) => {
  const { error } = payload;
  notify(error, 'danger');
  evt.target.classList.remove('disabled');
  user.classList.add('has-background-danger');
};

/** 
 * @description Realiza la conexion al servidor
 * @param {object} evt Evento implicito en la acción ejecutada
 */
const connectedToServer = evt => {
  const target = evt.target;
  if (target.value.length >= LENGTH_MIN_USERNAME) {
    target.classList.add('disabled');
    user.classList.remove('has-background-danger');
    socket = io.connect();
    socket.on('recive-message', reciveMessage);
    socket.on('registered-user', registerUser);
    socket.on('error-registered-user', payload => errorRegisteredUser(payload, evt));
    socket.on('client-been-writing', clientBeenWriting);
    socket.on('upload-progress', data => uploadProgress(data));
    const idHTML = generateIDHtml();
    socket.emit('connected-to-server', { user: target.value, idHTML });
  } else {
    notify(LITERAL.minSizeUser, 'danger');
  }
};

/** 
 * @description Mostramos el progreso de la subida
 * @param {object} data Información sobre la subida del archivo
 */
const uploadProgress = data => {
  const { recived, total, who } = data;
  const porcent = Math.floor((recived * 100) / total);
  const currentlySize = (recived / 1024) / 1024; // MB
  const totalSize = (total / 1024) / 1024; // MB
  const progress = document.querySelector('#upload-progress-bar');
  const infoProgress = document.querySelector('.info-progress');
  progress.value = Math.floor(porcent);
  progress.innerHTML = porcent.toFixed(2);
  infoProgress.innerHTML = `${currentlySize.toFixed(2)} MB ${totalSize.toFixed(2)} MB ${porcent} %`;
};

/** 
 * @description Cargamos un fichero y se sube al servidor
 * @param {object} evt Evento implicito en la acción ejecutada
 */
const upload = async evt => {
  if (user.value.length >= LENGTH_MIN_USERNAME) {
    const uploadProgress = document.querySelector('#containerProgress');
    uploadProgress.classList.remove('hidden');
    const btnUploadFile = document.querySelector('#btnUploadFile');
    btnUploadFile.classList.add('is-loading');
    btnUploadFile.setAttribute('disabled', true);
    const files = evt.target.files;
    const data = new FormData();
    data.append('archivo', files[0]);
    socket.emit('upload-file', { idUser: user.dataset.iduser });
    const result = await (await fetch('/upload-file', {
      method: 'POST',
      body: data
    })).json();
    btnUploadFile.classList.remove('is-loading');
    btnUploadFile.removeAttribute('disabled');
    const { statusCode, path, statusMessage } = result;
    if (statusCode === 200) {
      message.value = `${LITERAL.uploadFile} <a href='${statusMessage}' target='_blank'>[${files[0].name}]</a>`;
      sendMessage(evt = {key: 'Enter'}, true);
      notify(LITERAL.uploadSuccess, 'success', 4000);
    } else {
      notify(statusMessage, 'danger', 4000);
    }
    setTimeout(() => {
      uploadProgress.classList.add('hidden');
    }, 2000);
  } else {
    document.querySelector('form').reset();
    notify(LITERAL.minSizeUser, 'danger');
  }
};

/** 
 * @description Inicialización del chat
 */
const load = () => {
  const tabGeneral = document.querySelector('#tabGeneral');
  user = document.querySelector('#user');
  message = document.querySelector('#message');
  usersPanel = document.querySelector('#userConnected');
  notification = document.querySelector('.notification');
  message.addEventListener('keydown', evt => sendMessage(evt, true));
  message.addEventListener('keyup',  evt => sendMessage(evt, false));
  user.addEventListener('blur', connectedToServer);
  tabGeneral.addEventListener('click', selectedChat);
  uploadFile = document.querySelector('input[type=file]');
  uploadFile.addEventListener('change', upload);
};

/** 
 * @description Muestra notificaciones en el chat
 * @param {string} msn Mensaje que se muestra en la notificación
 * @param {string} type Tipo de mensaje (danger, info, success, warning)
 * @param {number} timeout Duración de la notificación
 */
const notify = (msn = '', type = 'info', timeout = 2000) => {
  notification.children[0].innerHTML = msn;
  notification.classList.add(`is-${type}`);
  notification.classList.remove('hidden');
  setTimeout(() => {
    notification.classList.add('hidden');
    notification.classList.remove(`is-${type}`);
  }, timeout);
};

/** 
 * @description Generamos un ID para cada usuario
 */
const generateIDHtml = () => new Date().getTime().toString().split('').map(i => String.fromCharCode(parseInt(i) + 65)).join('');

/** 
 * @description Espera a que este la página completamente cargada
 */
document.addEventListener("DOMContentLoaded", load);