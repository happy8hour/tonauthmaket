import express from 'express';
import path from 'path';
import cors from 'cors';
import { engine } from 'express-handlebars';
import { TonConnectServer, AuthRequestTypes } from '@tonapps/tonconnect-server';

// Перед продакшном хорошо бы запустить npx tonconnect-generate-sk и поставить 
// вывод в эту переменную
const staticSecret = 'K3eQqOX0nRCj4mhdMprREFobJi0+aAerTzyFY1Xnfe4=';

const port = 8080
const host = "192.168.100.3"
const hostname = `a3a7-37-214-23-133.eu.ngrok.io`;
  

function init() {
  const tonconnect = new TonConnectServer({ staticSecret });

  const app = express();

  // Может быть можно как-то по-другому организовать этот сервер, но у меня 
  // получилось только так
  app.use(cors());
  app.engine("handlebars", engine());
  app.set("view engine", "handlebars");
  app.set("views", path.resolve(__dirname, "./views"));

  // По этому пути будет формироваться request для тонкипера, для авторизации
  app.get('/authRequest', (req, res) => {
    const request = tonconnect.createRequest({
      image_url: 'https://web3ton.pro/images/rarity-item-placeholder.jpg',
      return_url: `${hostname}/tonconnect`,  // адрес кнопки Back to Site
      items: [{
        type: AuthRequestTypes.ADDRESS,
        required: true
      }, {
        type: AuthRequestTypes.OWNERSHIP,
        required: true
      }],
    }, {
      // Сюда можно что-нибудь положить для защиты, или для определения того, 
      // куда после логина вести пользователя (в настройки, личный кабинет),
      // или для красоты
      customField: 'some data...'
    });

    res.send(request);
  });

  // Сюда пойдёт пользователь после логина, принесёт с собой req, где будет
  // храниться информация о логине
  app.get('/tonconnect', async (req, res) => {
    try {
      const encodedResponse = req.query.tonlogin as string;
      // Вот тут расшифровка
      const response = tonconnect.decodeResponse(encodedResponse);

      // То, что мы передадим на страницу успеха
      let message = '';

      for (let payload of response.payload) {
        // Мы допускаем несколько типов логина: просто любым кошельком и
        // кошельком, но подтвердим, что ты его владелец
        switch (payload.type) {
          case AuthRequestTypes.OWNERSHIP: 
            // Проверяем хитромудрой системой безопасности точно ли владелец
            const isVerified = await tonconnect.verifyTonOwnership(payload, response.client_id);

            message = isVerified 
              ? `${payload.address} (ton-ownership)`
              : `ton-ownership is NOT verified!`

            break;

          case AuthRequestTypes.ADDRESS: 
            message = `${payload.address} (ton-address)`
            break;
        }
      }

      // Возвращаем по этому пути страницу с успехом и передаём в неё результат
      res.render("success", {
          layout: false,
          userWallet: message
      });

    } catch (error) {
      console.log(error);
      res.status(400).send({ error });
    }
  });

  // Я нашёл как отрисовывать главную страницу только таким образом
  app.get('/', (req, res) => {
    res.render("index", {
        layout: false,
        requestEndpoint: `${hostname}/authRequest`
    });
  });

  app.listen(port, host, () => {
    console.log(`Server running at http://${hostname}/`);
  });
}

init();
