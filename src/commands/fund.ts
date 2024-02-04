import { defineCommand } from 'citty';

export const fundCommand = defineCommand({
  meta: {
    name: 'fund',
    description: 'Fund existing account with amount or create account and fund it',
  },
  args: {
    recipient: {
      type: 'positional',
      name: 'recipient',
      description: 'Recipient account',
    },
    amount: {
      type: 'positional',
      name: 'amount',
      description: 'Amount',
    },
    preflight: {
      type: 'boolean',
      name: 'preflight',
      description: 'Preflight',
      defaultValue: false,
    },
  },
  run: async ({ args }) => {
    console.log(args);
    const { recipient, amount, preflight } = args;
    console.log('Funding account...', recipient, amount);
    await fund(recipient, amount, preflight);
  },
});

export const fundAdminCommand = defineCommand({
  meta: {
    name: 'fund-admin',
    description: 'Fund Admin account with amount or create account and fund it',
  },
  args: {
    amount: {
      type: 'positional',
      name: 'amount',
      description: 'Amount',
    },
    preflight: {
      type: 'boolean',
      name: 'preflight',
      description: 'Preflight',
      defaultValue: false,
    },
  },
  run: async ({ args }) => {
    // console.log(args);
    // const { amount, preflight } = args;
    // const recipient = env.APP_ADMIN_ACCOUNT;
    // console.log('Funding admin account...', recipient, amount);
    // await fund(recipient, amount, preflight);
  },
});
