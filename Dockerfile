FROM node:10.13-alpine
# Create app directory
RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app
WORKDIR /home/node/app
# Install app dependencies
COPY package*.json ./
USER node
RUN npm install
# Bundle app source
COPY --chown=node:node . .
EXPOSE 7777
CMD [ "node", "appDev.js" ]
