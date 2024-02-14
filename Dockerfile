FROM salamaashoush/kdevnet:on-demand-no-start-nodejs-amd64

USER root
COPY . /devnet/app
# COPY dist /devnet/app
# COPY package.json /devnet/app
# COPY pact-toolbox.config.ts /devnet/app
# COPY pact /devnet/app/pact

WORKDIR /devnet/app


# Install packages
RUN pnpm install

WORKDIR /devnet/app/apps/todo-mvc
# Install pact prelude
# RUN pnpm cli prelude

CMD [ "pnpm", "test"]
