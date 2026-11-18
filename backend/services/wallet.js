/** PehchanWallet.get_wallet / deposit / withdraw (pehchan/models.py) */
import sequelize from '../db.js';
import { PehchanWallet, WalletTransaction } from '../models/index.js';

const toCents = (v) => Math.round(Number(v) * 100);
const fromCents = (c) => (c / 100).toFixed(2);

export async function getWallet(transaction) {
  const [wallet] = await PehchanWallet.findOrCreate({ where: { id: 1 }, defaults: { id: 1, balance: '0.00' }, transaction });
  return wallet;
}

async function withTransaction(transaction, fn) {
  if (transaction) return fn(transaction);
  return sequelize.transaction((t) => fn(t));
}

export async function deposit(amount, { description = '', transactionType = 'donation', transaction } = {}) {
  const cents = toCents(amount);
  if (!(cents > 0)) throw new Error('Deposit amount must be positive');
  await getWallet(transaction);
  return withTransaction(transaction, async (t) => {
    const wallet = await PehchanWallet.findByPk(1, { transaction: t, lock: t.LOCK.UPDATE });
    wallet.balance = fromCents(toCents(wallet.balance) + cents);
    await wallet.save({ transaction: t });
    return WalletTransaction.create(
      {
        wallet_id: wallet.id,
        amount: fromCents(cents),
        transaction_type: transactionType,
        description,
        balance_after_transaction: wallet.balance,
      },
      { transaction: t }
    );
  });
}

export async function withdraw(amount, { description = '', transactionType = 'expense', transaction } = {}) {
  const cents = toCents(amount);
  if (!(cents > 0)) throw new Error('Withdrawal amount must be positive');
  await getWallet(transaction);
  return withTransaction(transaction, async (t) => {
    const wallet = await PehchanWallet.findByPk(1, { transaction: t, lock: t.LOCK.UPDATE });
    if (cents > toCents(wallet.balance)) throw new Error('Insufficient funds in wallet');
    wallet.balance = fromCents(toCents(wallet.balance) - cents);
    await wallet.save({ transaction: t });
    return WalletTransaction.create(
      {
        wallet_id: wallet.id,
        amount: fromCents(-cents),
        transaction_type: transactionType,
        description,
        balance_after_transaction: wallet.balance,
      },
      { transaction: t }
    );
  });
}
