# mcp-jpexs

MCP (Model Context Protocol) server for decompiling Adobe Flash **SWF** files with [JPEXS FFDec](https://github.com/jindrapetrik/jpexs-decompiler). Lets AI agents extract resources and decompile ActionScript directly from a chat session.

## Requirements

- **Node.js** 18+
- **Java 8** on the `PATH` — FFDec (the bundled decompiler) does not run on newer Java versions. The server detects incompatible Java versions and returns a clear error message.

## Installation

```bash
npm install
npm run build
```

## Usage

Register the server in your MCP client:

```json
{
    "mcpServers": {
        "jpexs": {
            "command": "node",
            "args": ["D:/path/to/mcp-jpexs/dist/index.js"]
        }
    }
}
```

The server communicates over stdio.

## Tools

### `extract_swf_resources`

Extracts resources from a SWF file to a directory and returns the list of generated files.

| Param       | Type       | Required | Description                                                              |
| ----------- | ---------- | -------- | ------------------------------------------------------------------------ |
| `file`      | `string`   | yes      | Path to the source `.swf` file                                           |
| `outputDir` | `string`   | no       | Output directory (created if missing). Defaults to a temporary directory |
| `items`     | `string[]` | no       | Resource types to export. Defaults to `["all"]`                          |
| `formats`   | `string[]` | no       | Output formats, e.g. `script:as`, `image:png`. Omit for defaults         |

**Items:** `all`, `fla`, `text`, `script`, `image`, `shape`, `movie`, `font`, `frame`, `sprite`, `button`, `sound`, `binaryData`, `morphshape`

**Formats:**

| Category   | Options                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------- |
| Script     | `script:as`, `script:hex`, `script:pcode`, `script:pcodehex`                                        |
| Shape      | `shape:svg`, `shape:bmp`, `shape:png`, `shape:canvas`                                               |
| MorphShape | `morphshape:svg`, `morphshape:canvas`                                                               |
| Frame      | `frame:bmp`, `frame:png`, `frame:svg`, `frame:gif`, `frame:avi`, `frame:pdf`, `frame:canvas`        |
| Sprite     | `sprite:bmp`, `sprite:png`, `sprite:svg`, `sprite:gif`, `sprite:avi`, `sprite:pdf`, `sprite:canvas` |
| Button     | `button:bmp`, `button:png`, `button:svg`                                                            |
| Image      | `image:bmp`, `image:png`, `image:svg`, `image:jpeg`, `image:png_gif_jpeg`                           |
| Text       | `text:svg`, `text:plain`, `text:formatted`                                                          |
| Font       | `font:ttf`, `font:woff`                                                                             |
| Sound      | `sound:flv`, `sound:wav`, `sound:mp3_wav_flv`                                                       |

### `decompile_swf_scripts`

Decompiles ActionScript from a SWF and returns the script contents inline — useful for analyzing SWF logic without reading files from disk.

| Param    | Type     | Required | Description                                                            |
| -------- | -------- | -------- | ---------------------------------------------------------------------- |
| `file`   | `string` | yes      | Path to the source `.swf` file                                         |
| `format` | `string` | no       | `script:as` (default), `script:hex`, `script:pcode`, `script:pcodehex` |

Large results are truncated (at most 200 files / 100,000 characters total).

## Development

```bash
npm run build         # compile TypeScript to dist/
npm run start         # run the server
npm run watch         # tsc in watch mode
npm run lint          # eslint
npm run lint:fix      # eslint --fix (removes unused imports)
npm run format        # prettier --write
npm run format:check  # prettier --check
```

### Code style

- **Prettier**: no semicolons, double quotes, 4-space indent, sorted/grouped imports (`@ianvs/prettier-plugin-sort-imports`)
- **ESLint**: flat config with `typescript-eslint` + `eslint-plugin-unused-imports` (unused imports are removed by `lint:fix`)

### TypeScript

Builds use the native TypeScript 7 compiler (aliased as `@typescript/native`, providing `tsc`). The `typescript` package is aliased to `@typescript/typescript6` because `typescript-eslint` still depends on the TS 6 API — see the [TypeScript 7.0 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0).

## License

MIT
