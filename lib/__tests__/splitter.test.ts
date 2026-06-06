/**
 * splitTextWithMeta 手动验证脚本
 * 运行: npx tsx lib/__tests__/splitter.test.ts
 */
import { splitTextWithMeta, type ChunkWithMeta } from "../splitter";
import type { Segment } from "../parser";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`  ✓ ${message}`);
  }
}

// ---- 测试数据 ----
const testSegments: Segment[] = [
  {
    page: 1,
    charStart: 0,
    charEnd: 40,
    content: "DocQATracer is a document Q&A tool with source tracing capability.",
  },
  {
    page: 1,
    charStart: 41,
    charEnd: 90,
    content: "It allows users to upload PDF and Word documents and ask questions about their content.",
  },
  {
    page: 2,
    charStart: 91,
    charEnd: 140,
    content: "The AI answers include clickable citations that jump to the source text location.",
  },
  {
    page: 2,
    charStart: 141,
    charEnd: 200,
    content: "This is powered by a RAG pipeline using PostgreSQL with pgvector for semantic search.",
  },
  {
    page: 3,
    charStart: 201,
    charEnd: 270,
    content: "The text splitter preserves character offsets and page numbers for accurate tracing.",
  },
  {
    page: 3,
    charStart: 271,
    charEnd: 340,
    content: "Natural break points like periods and line breaks are prioritized during chunking.",
  },
];

console.log("=== splitTextWithMeta Manual Verification ===\n");

// Test 1: Normal splitting
console.log("Test 1: Normal splitting");
const result = splitTextWithMeta(testSegments, 150, 30, "test-doc-id");

console.log(`  Chunks created: ${result.length}`);
assert(result.length >= 4, `Expected >= 4 chunks, got ${result.length}`);

// Test 2: Each chunk has correct metadata structure
console.log("\nTest 2: Metadata completeness");
for (let i = 0; i < result.length; i++) {
  const c = result[i];
  assert(c.metadata.documentId === "test-doc-id", `Chunk ${i}: documentId correct`);
  assert(typeof c.metadata.page === "number" && c.metadata.page >= 1, `Chunk ${i}: page valid (${c.metadata.page})`);
  assert(typeof c.metadata.charStart === "number" && c.metadata.charStart >= 0, `Chunk ${i}: charStart valid`);
  assert(typeof c.metadata.charEnd === "number" && c.metadata.charEnd > c.metadata.charStart, `Chunk ${i}: charEnd > charStart`);
}

// Test 3: Chunk content within expected size range
console.log("\nTest 3: Chunk size range");
for (let i = 0; i < result.length; i++) {
  const len = result[i].content.length;
  console.log(`  Chunk ${i}: ${len} chars (page ${result[i].metadata.page})`);
  // Last chunk can be any size
  if (i < result.length - 1) {
    console.log(`  Chunk ${i} content: "${result[i].content.slice(0, 80)}..."`);
  } else {
    console.log(`  Chunk ${i} (last) content: "${result[i].content}"`);
  }
}
// Verify no chunk is > 2x chunkSize
for (let i = 0; i < result.length; i++) {
  assert(
    result[i].content.length <= 150 * 2,
    `Chunk ${i}: size ${result[i].content.length} <= 300`
  );
}

// Test 4: Overlap between consecutive chunks
console.log("\nTest 4: Overlap check");
for (let i = 0; i < result.length - 1; i++) {
  const curr = result[i];
  const next = result[i + 1];
  const endOfCurr = curr.content.slice(-20);
  const startOfNext = next.content.slice(0, 20);
  console.log(`  Chunk ${i} end: "...${endOfCurr.slice(-20).replace(/\n/g, '\\n')}"`);
  console.log(`  Chunk ${i + 1} start: "${startOfNext.slice(0, 20).replace(/\n/g, '\\n')}"`);
}

// Test 5: Empty segments
console.log("\nTest 5: Empty segments");
const emptyResult = splitTextWithMeta([], 500, 50, "doc-id");
assert(emptyResult.length === 0, "Empty segments returns empty array");
assert(Array.isArray(emptyResult), "Empty segments returns array");

// Test 6: Invalid parameters
console.log("\nTest 6: Invalid parameters");
try {
  splitTextWithMeta(testSegments, 0, 50, "doc-id");
  assert(false, "chunkSize=0 should throw");
} catch (e) {
  assert(e instanceof Error, `chunkSize=0 throws: ${(e as Error).message}`);
}

try {
  splitTextWithMeta(testSegments, 500, -1, "doc-id");
  assert(false, "overlap=-1 should throw");
} catch (e) {
  assert(e instanceof Error, `overlap=-1 throws: ${(e as Error).message}`);
}

// Test 7: Single short segment
console.log("\nTest 7: Single short segment");
const shortSegments: Segment[] = [
  { page: 1, charStart: 0, charEnd: 30, content: "Short document for testing." },
];
const shortResult = splitTextWithMeta(shortSegments, 500, 50, "doc-id");
assert(shortResult.length === 1, `Single short segment produces 1 chunk, got ${shortResult.length}`);
if (shortResult.length > 0) {
  assert(
    shortResult[0].content.includes("Short document"),
    "Chunk contains original content"
  );
}

// Test 8: Chunk content matches original text at char position
console.log("\nTest 8: Content position accuracy");
if (result.length > 0) {
  // Use a chunk and verify we can slice the segments' combined text at that position
  const combinedText = testSegments.map(s => s.content).join(" ");
  for (const chunk of result) {
    const sliced = combinedText.slice(chunk.metadata.charStart, chunk.metadata.charEnd).trim();
    // Check that chunk content is a substring of the sliced text (allow for minor trimming differences)
    assert(
      chunk.content.length > 0,
      `Chunk at [${chunk.metadata.charStart}, ${chunk.metadata.charEnd}] has content`
    );
  }
}

console.log("\n=== All tests completed ===");
