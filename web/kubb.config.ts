import { defineConfig } from "@kubb/core";
import { pluginClient } from "@kubb/plugin-client";
import { pluginOas } from "@kubb/plugin-oas";
import { pluginReactQuery } from "@kubb/plugin-react-query";
import { pluginTs } from "@kubb/plugin-ts";
import { pluginZod } from "@kubb/plugin-zod";

import type { ResolveNameParams } from "@kubb/core";

function removeControllerSuffix(name: string) {
  return name.replace(/([-_]?controller[-_]?)/gi, "");
}

const transformers = {
  name: (name: ResolveNameParams["name"]) => removeControllerSuffix(name),
};

export default defineConfig({
  root: ".",
  input: {
    path: "../docs/swagger.json",
  },
  output: {
    path: "./src/__generated__/api",
    clean: true,
  },
  plugins: [
    pluginOas(),
    pluginTs({
      output: {
        path: "types",
      },
      transformers,
    }),
    pluginClient({
      output: {
        path: "client",
      },
      baseURL: "/api",
      importPath: "@/lib/api-client",
      transformers,
    }),
    pluginReactQuery({
      output: {
        path: "hooks",
      },
      client: {
        importPath: "@/lib/api-client",
      },
      transformers,
    }),
    pluginZod({
      output: {
        path: "zod",
      },
      importPath: "zod",
      version: "4",
      // typed: true,
      dateType: "string",
      unknownType: "unknown",
      transformers,
    }),
  ],
});
