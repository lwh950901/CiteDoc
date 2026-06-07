/** SSE 溯源引用元数据，服务端与客户端共享 */
export interface Source {
  id: number;
  page: number;
  chunkId: string;
  charStart: number;
  charEnd: number;
  snippet: string;
}
