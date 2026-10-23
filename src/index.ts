#!/usr/bin/env node
import { promises as fs } from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import * as jpexs from "@marcuth/jpexs-decompiler"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

import { version } from "../package.json"

const ITEM_VALUES = Object.values(jpexs.Item) as [jpexs.Item, ...jpexs.Item[]]

const FORMAT_VALUES = [
    ...Object.values(jpexs.ScriptFormat),
    ...Object.values(jpexs.ShapeFormat),
    ...Object.values(jpexs.MorphShapeFormat),
    ...Object.values(jpexs.FrameFormat),
    ...Object.values(jpexs.SpriteFormat),
    ...Object.values(jpexs.ButtonFormat),
    ...Object.values(jpexs.ImageFormat),
    ...Object.values(jpexs.TextFormat),
    ...Object.values(jpexs.FontFormat),
    ...Object.values(jpexs.SoundFormat),
] as [string, ...string[]]

const SCRIPT_FORMAT_VALUES = Object.values(jpexs.ScriptFormat) as [
    jpexs.ScriptFormat,
    ...jpexs.ScriptFormat[],
]

const MAX_SCRIPT_FILES = 200
const MAX_SCRIPT_CHARS = 100_000

interface ExtractedFile {
    path: string
    size: number
}

async function resolveExistingFile(file: string): Promise<string> {
    const resolved = path.resolve(file)
    const stat = await fs.stat(resolved).catch(() => null)
    if (!stat || !stat.isFile()) {
        throw new Error(`SWF file not found: ${resolved}`)
    }
    return resolved
}

async function resolveOutputDir(outputDir?: string): Promise<string> {
    if (outputDir) {
        const resolved = path.resolve(outputDir)
        await fs.mkdir(resolved, { recursive: true })
        return resolved
    }
    return fs.mkdtemp(path.join(os.tmpdir(), "mcp-jpexs-"))
}

async function listFilesRecursive(
    dir: string,
    base = dir,
): Promise<ExtractedFile[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const files: ExtractedFile[] = []
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            files.push(...(await listFilesRecursive(fullPath, base)))
        } else {
            const stat = await fs.stat(fullPath)
            files.push({ path: path.relative(base, fullPath), size: stat.size })
        }
    }
    return files
}

function friendlyError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes("ENOENT") && message.includes("java")) {
        return "Java runtime not found. JPEXS FFDec requires Java 8 installed and available on the PATH."
    }
    if (
        message.includes("NoClassDefFoundError") ||
        message.includes("ExceptionInInitializerError") ||
        message.includes("UnsupportedClassVersionError") ||
        message.includes("java.lang.Error: modifiers")
    ) {
        return (
            "FFDec failed to initialize, usually caused by an incompatible Java version. " +
            "JPEXS FFDec requires Java 8. Ensure 'java' on the PATH points to a Java 8 runtime."
        )
    }
    return message
}

function errorResult(error: unknown) {
    return {
        content: [{ type: "text" as const, text: friendlyError(error) }],
        isError: true,
    }
}

const server = new McpServer({
    name: "mcp-jpexs",
    version: version,
})

server.registerTool(
    "extract_swf_resources",
    {
        title: "Extract SWF resources",
        description:
            "Extract resources from an Adobe Flash SWF file using JPEXS FFDec (decompiler). " +
            "Exports selected resource types (scripts, images, shapes, morph shapes, sprites, buttons, frames, fonts, sounds, texts, binary data, movies) " +
            "to a directory. By default exports everything (item 'all'). Returns the list of generated files with their sizes.",
        inputSchema: {
            file: z
                .string()
                .describe("Absolute or relative path to the source .swf file"),
            outputDir: z
                .string()
                .optional()
                .describe(
                    "Directory where extracted files will be written. Created if missing. Defaults to a temporary directory.",
                ),
            items: z
                .array(z.enum(ITEM_VALUES))
                .optional()
                .describe(
                    "Resource types to export. Possible values: all, fla, text, script, image, shape, movie, font, frame, sprite, button, sound, binaryData, morphshape. Defaults to ['all'].",
                ),
            formats: z
                .array(z.enum(FORMAT_VALUES))
                .optional()
                .describe(
                    "Output formats, e.g. 'script:as', 'image:png', 'shape:svg', 'sound:mp3_wav_flv'. " +
                        "Each format applies to its matching resource type; omit to use defaults.",
                ),
        },
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    },
    async ({ file, outputDir, items, formats }) => {
        try {
            const resolvedFile = await resolveExistingFile(file)
            const resolvedOutput = await resolveOutputDir(outputDir)

            await jpexs.extract({
                file: resolvedFile,
                output: resolvedOutput,
                items: items as jpexs.Item[] | undefined,
                formats: formats as jpexs.Format[] | undefined,
                silence: true,
            })

            const files = await listFilesRecursive(resolvedOutput)
            const summary = {
                source: resolvedFile,
                outputDir: resolvedOutput,
                fileCount: files.length,
                files,
            }
            return {
                content: [
                    {
                        type: "text" as const,
                        text: JSON.stringify(summary, null, 2),
                    },
                ],
            }
        } catch (error) {
            return errorResult(error)
        }
    },
)

server.registerTool(
    "decompile_swf_scripts",
    {
        title: "Decompile SWF scripts",
        description:
            "Decompile ActionScript code from an Adobe Flash SWF file and return the script contents inline. " +
            "Useful for analyzing SWF logic without reading files from disk. " +
            "Large results are truncated (at most " +
            MAX_SCRIPT_FILES +
            " files / " +
            MAX_SCRIPT_CHARS +
            " characters total).",
        inputSchema: {
            file: z
                .string()
                .describe("Absolute or relative path to the source .swf file"),
            format: z
                .enum(SCRIPT_FORMAT_VALUES)
                .optional()
                .describe(
                    "Script output format: 'script:as' (ActionScript source, default), 'script:hex', 'script:pcode', 'script:pcodehex'.",
                ),
        },
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    },
    async ({ file, format }) => {
        try {
            const resolvedFile = await resolveExistingFile(file)
            const outputDir = await resolveOutputDir(undefined)

            await jpexs.extract({
                file: resolvedFile,
                output: outputDir,
                items: [jpexs.Item.Script],
                formats: [format ?? jpexs.ScriptFormat.As],
                silence: true,
            })

            const extracted = (await listFilesRecursive(outputDir)).sort(
                (a, b) => a.path.localeCompare(b.path),
            )
            const scripts: {
                path: string
                size: number
                content: string
                truncated: boolean
            }[] = []
            let totalChars = 0
            let truncated = false

            for (const entry of extracted.slice(0, MAX_SCRIPT_FILES)) {
                if (totalChars >= MAX_SCRIPT_CHARS) {
                    truncated = true
                    break
                }
                const content = await fs.readFile(
                    path.join(outputDir, entry.path),
                    "utf8",
                )
                let scriptContent = content
                let scriptTruncated = false
                const remaining = MAX_SCRIPT_CHARS - totalChars
                if (content.length > remaining) {
                    scriptContent = content.slice(0, remaining)
                    scriptTruncated = true
                    truncated = true
                }
                totalChars += scriptContent.length
                scripts.push({
                    path: entry.path,
                    size: entry.size,
                    content: scriptContent,
                    truncated: scriptTruncated,
                })
            }
            if (extracted.length > MAX_SCRIPT_FILES) {
                truncated = true
            }

            const summary = {
                source: resolvedFile,
                scriptCount: extracted.length,
                returnedCount: scripts.length,
                truncated,
                scripts,
            }
            return {
                content: [
                    {
                        type: "text" as const,
                        text: JSON.stringify(summary, null, 2),
                    },
                ],
            }
        } catch (error) {
            return errorResult(error)
        }
    },
)

async function main() {
    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.error("mcp-jpexs server running on stdio")
}

main().catch((error) => {
    console.error("Fatal error:", friendlyError(error))
    process.exit(1)
})
