import tseslint from "typescript-eslint";

/**
 * Guardrails as code. All custom rules ERROR, never warn.
 *
 * 1. No hardcoded hex colours in app/** or components/** — tokens only.
 * 2. No float-producing APIs in lib/money/** (parseFloat & friends).
 *    Division / arbitrary float arithmetic is covered by the regex check
 *    in scripts/check-money-floats.mjs, wired into `pnpm lint` and CI —
 *    a clean AST rule for "operand is provably integer" is impractical.
 * 3. No localStorage / sessionStorage anywhere.
 * 4. No `outline: none` without a focus replacement (string-literal ban;
 *    stylesheets are covered by the same greps in check-money-floats runner).
 */

const noHexColours = {
  meta: { type: "problem", messages: { hex: "Hardcoded hex colour. Use a token from app/globals.css." } },
  create(context) {
    const HEX = /#[0-9a-fA-F]{3,8}\b/;
    return {
      Literal(node) {
        if (typeof node.value === "string" && HEX.test(node.value)) {
          context.report({ node, messageId: "hex" });
        }
      },
      TemplateElement(node) {
        if (HEX.test(node.value.raw)) {
          context.report({ node, messageId: "hex" });
        }
      },
    };
  },
};

const noOutlineNone = {
  meta: { type: "problem", messages: { outline: "`outline: none` without a focus replacement fails the accessibility floor." } },
  create(context) {
    const BAD = /outline\s*:\s*none|outline-none/;
    return {
      Literal(node) {
        if (typeof node.value === "string" && BAD.test(node.value)) {
          context.report({ node, messageId: "outline" });
        }
      },
      TemplateElement(node) {
        if (BAD.test(node.value.raw)) {
          context.report({ node, messageId: "outline" });
        }
      },
    };
  },
};

const plugin = {
  rules: { "no-hex-colours": noHexColours, "no-outline-none": noOutlineNone },
};

export default tseslint.config(
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...tseslint.configs.recommended,
  {
    plugins: { productforge: plugin },
    rules: {
      // 3. Browser storage is banned everywhere.
      "no-restricted-globals": [
        "error",
        { name: "localStorage", message: "Browser storage is banned in this project." },
        { name: "sessionStorage", message: "Browser storage is banned in this project." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "window", property: "localStorage", message: "Browser storage is banned in this project." },
        { object: "window", property: "sessionStorage", message: "Browser storage is banned in this project." },
      ],
    },
  },
  {
    // 1. Tokens only in UI code. globals.css is CSS, not linted here.
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    plugins: { productforge: plugin },
    rules: {
      "productforge/no-hex-colours": "error",
      "productforge/no-outline-none": "error",
    },
  },
  {
    // 2. Money code: ban float-producing APIs outright.
    files: ["lib/money/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='parseFloat']",
          message: "parseFloat is banned in money code. All money is integer cents.",
        },
        {
          selector: "CallExpression[callee.object.name='Number'][callee.property.name='parseFloat']",
          message: "Number.parseFloat is banned in money code. All money is integer cents.",
        },
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: "Math.random has no place in money code.",
        },
      ],
    },
  }
);
