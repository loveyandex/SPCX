"use client";

import NextLink from "next/link";

import { localePath } from "./t";

export default function Link({ href, ...rest }: React.ComponentProps<typeof NextLink>) {
  const localized = typeof href === "string" ? localePath(href) : href;
  return <NextLink href={localized} {...rest} />;
}
