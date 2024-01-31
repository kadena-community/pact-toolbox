// import { Pact } from '@kadena/client';
// import { env } from './env';
// import { getAccountKey, signWithAdmin, submitAndListen } from '../utils';
// import { defineCommand } from 'citty';

// export async function createPrincipalNamespace() {
//   const pactCommand = `
//     (let ((ns-name (ns.create-principal-namespace (read-keyset 'admin-keyset))))
//       (define-namespace ns-name (read-keyset 'admin-keyset ) (read-keyset 'admin-keyset))
//     )
//   `;
//   const admin = env.APP_ADMIN_ACCOUNT;
//   const transaction = Pact.builder
//     .execution(pactCommand)
//     .addData('admin-keyset', {
//       keys: [getAccountKey(admin)],
//       pred: 'keys-all',
//     })
//     .addSigner(getAccountKey(admin))
//     .setMeta({ chainId: env.APP_CHAIN_ID, senderAccount: admin })
//     .setNetworkId(env.APP_NETWORK_ID)
//     .createTransaction();

//   const signedTx = await signWithAdmin(transaction);
//   const data = await submitAndListen<string>(signedTx);
//   return data.replace('Namespace defined: ', '');
// }

// export const createNamespaceCommand = defineCommand({
//   meta: {
//     name: 'create-ns',
//     description: 'Create principal namespace for admin account',
//   },
//   run: async () => createPrincipalNamespace(),
// });
