import { Tokenizer } from '@huggingface/tokenizers';

export function encodeComment(tokenizer: Tokenizer, text: string): { ids: bigint[]; mask: bigint[] } {
  const cls = tokenizer.token_to_id('[CLS]'), sep = tokenizer.token_to_id('[SEP]'), pad = tokenizer.token_to_id('[PAD]');
  if (cls === undefined || sep === undefined || pad === undefined) throw new Error('Missing special tokens');
  const tokens = tokenizer.encode(text.normalize('NFKC'), { add_special_tokens: false }).ids.slice(0, 126);
  const ids = [cls, ...tokens, sep];
  const mask = ids.map(() => 1n);
  while (ids.length < 128) { ids.push(pad); mask.push(0n); }
  return { ids: ids.map(BigInt), mask };
}
