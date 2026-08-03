/**
 * 事务(Transaction)
 *
 * 一次命令执行的所有域事件共享同一 transactionId。
 * 序列号 sequence 在战斗内单调递增,确保日志可重放。
 */

let counter = 0;

export function nextTransactionId(): string {
  counter += 1;
  return `tx_${Date.now().toString(36)}_${counter.toString(36)}`;
}

/** 文档推荐:在战斗初始化时把 counter 复位,避免跨战役串号 */
export function resetTransactionCounter(): void {
  counter = 0;
}
