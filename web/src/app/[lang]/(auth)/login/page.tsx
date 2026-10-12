"use client";

import { useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { AlertTriangle, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/app/[lang]/(main)/_components/sidebar/language-switcher";
import { t as tr, localePath } from "@/i18n/t";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [readToEnd, setReadToEnd] = useState(false);
  const termsBodyRef = useRef<HTMLDivElement>(null);

  // 滚动到条款底部（含无需滚动即可完整展示的情况）方可点击「同意」。
  function handleTermsScroll() {
    const el = termsBodyRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setReadToEnd(true);
  }

  useEffect(() => {
    if (!termsOpen) return;
    // 打开时重置，并处理内容本就不足一屏、无法触发滚动的场景。
    setReadToEnd(false);
    const el = termsBodyRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 8) setReadToEnd(true);
  }, [termsOpen]);

  useEffect(() => {
    // 已登录直接进主界面（静态导出下无 middleware 代劳这层跳转）。
    const token = auth.getToken();
    if (token) {
      // localStorage 可能仍有凭据但 cookie 已丢失。先同步，再发起全新请求，
      // 避免服务端守卫或路由缓存把跳转送回仍处于 checking 状态的登录页。
      auth.setToken(token);
      window.location.replace(localePath("/function/tasks"));
      return;
    }
    api
      .authStatus()
      .then(({ initialized }) => {
        if (!initialized) router.replace(localePath("/setup"));
      })
      .catch(() => setError(tr("Cannot connect to the backend service")))
      .finally(() => setChecking(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) {
      setError(tr("Please read and accept the Usage Notice first"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { token } = await api.login("ARTEX", password);
      auth.setToken(token);
      window.location.replace(localePath("/function/tasks"));
    } catch {
      setError(tr("Incorrect username or password"));
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div role="status" className="flex min-h-dvh items-center justify-center text-muted-foreground">
        
        {tr("Checking sign-in status…")}
      </div>
    );
  }

  return (
    <div className="flex h-dvh">
      {/* Left panel */}
      <div className="hidden flex-col items-center justify-center bg-primary p-12 text-center lg:flex lg:w-1/3">
        <div className="relative flex items-center justify-center">
          <div className="absolute size-80 rounded-full border border-primary-foreground/10" />
          <div className="absolute size-60 rounded-full border border-primary-foreground/15" />
          <div className="absolute size-40 rounded-full border border-primary-foreground/20" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="ARTEX" width={160} height={160} className="relative brightness-0 invert" />
        </div>
      </div>

      {/* Right panel */}
      <div className="relative flex w-full items-center justify-center bg-background p-8 lg:w-2/3">
        <div className="absolute top-4 end-4">
          <LanguageSwitcher />
        </div>
        <div className="w-full max-w-md space-y-10 py-24 lg:py-32">
          <div className="space-y-4 text-center">
            <h2 className="text-2xl font-medium tracking-tight">{tr("Sign in")}</h2>
            <p className="mx-auto max-w-xl text-muted-foreground">{tr("Welcome back. Enter your password to continue using ARTEX.")}</p>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">{tr("Username")}</Label>
              <Input id="username" value="ARTEX" readOnly className="bg-muted text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{tr("Password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tr("Please enter the password")}
                autoFocus
                autoComplete="current-password"
              />
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="agree-terms"
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="agree-terms" className="text-sm font-normal leading-relaxed text-muted-foreground">
                
                {tr("I have read and agree to")}
                <button
                  type="button"
                  onClick={() => setTermsOpen(true)}
                  className="mx-0.5 font-medium text-primary underline-offset-4 hover:underline"
                >
                  
                  {tr("Usage Notice")}
                </button>
              </Label>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || !password || !agreed}>
              {loading ? tr("Signing in...") : tr("Sign in")}
            </Button>
          </form>
        </div>
      </div>

      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="gap-0 p-0 sm:max-w-2xl">
          <DialogHeader className="flex-row items-center gap-3 border-b px-6 py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </div>
            <div className="space-y-0.5">
              <DialogTitle className="text-base">{tr("ARTEX terms of use and disclaimer")}</DialogTitle>
              <p className="text-xs text-muted-foreground">
                
                {tr("Version v1.0 · Effective 2026-09-18 · Read every term below before you sign in")}
              </p>
            </div>
          </DialogHeader>

          <div
            ref={termsBodyRef}
            onScroll={handleTermsScroll}
            className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-muted-foreground"
          >
            <p className="rounded-lg border bg-muted/40 p-3 text-foreground/80">
              
              {tr("This Usage Notice and Disclaimer (the “Statement”) is the agreement between you and the authors and contributors of the ARTEX project about your use of this software. Read it carefully and make sure you understand every term before you use the software, especially the disclaimer, limitation of liability, and prohibited-conduct terms marked in bold or in a highlight.")}
              <span className="font-medium text-foreground">
                {" "}
                
                {tr("Downloading, installing, accessing, or otherwise using this software means you have read, understood, and agreed to be fully bound by this Statement.")}
              </span>
            </p>

            <section className="space-y-1.5">
              <h4 className="flex items-center gap-2 font-medium text-foreground">
                <span className="flex size-5 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                  1
                </span>
                
                {tr("Article 1 · Definitions and open-source license")}
              </h4>
              <p className="pl-7">
                
                {tr("This software (ARTEX) is an open-source program released under the GNU Affero General Public License v3.0 (AGPL-3.0). You may use, copy, modify, and distribute it under that license. Any derivative work, including an online service offered to third parties over a network, must also be released under AGPL-3.0, and the corresponding complete source code must be made available to its users. The full AGPL-3.0 terms are those in the accompanying LICENSE file.")}
              </p>
            </section>

            <section className="space-y-1.5">
              <h4 className="flex items-center gap-2 font-medium text-foreground">
                <span className="flex size-5 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                  2
                </span>
                
                {tr("Article 2 · Permitted use")}
              </h4>
              <p className="pl-7">
                
                {tr("This software is only for personal learning, code research, discussion of security principles, and technical verification inside a locally isolated environment that you set up yourself. It is meant for non-offensive, non-destructive uses such as learning, academic research, and code review. Except where this article expressly allows it, you may not use this software for any other purpose.")}
              </p>
            </section>

            <section className="space-y-2">
              <h4 className="flex items-center gap-2 font-medium text-destructive">
                <span className="flex size-5 items-center justify-center rounded-md bg-destructive/10 text-xs font-semibold text-destructive">
                  3
                </span>
                <AlertTriangle className="size-4" />
                
                {tr("Article 3 · Prohibited conduct")}
              </h4>
              <ul className="ml-7 list-decimal space-y-1.5 rounded-lg border border-destructive/20 bg-destructive/5 p-3 pl-8 text-foreground/80 marker:text-destructive/70">
                <li>
                  
                  {tr("You must not scan, probe, exploit, or attack any website, online service, or networked system owned by another person or a third party (whether or not you have authorization, and whether or not you consider it your own asset);")}
                </li>
                <li>{tr("Do not use this software for any real penetration test, offensive or defensive engagement, red-team or blue-team exercise, or production environment;")}</li>
                <li>{tr("Do not use this software for illegal intrusion, data theft, extortion, denial of service (DoS/DDoS), or any destructive or criminal activity;")}</li>
                <li>{tr("Do not remove, alter, or bypass any copyright, license, or safety notice in this software or its output;")}</li>
                <li>{tr("Do not do anything that violates the laws, regulations, or regulatory requirements of your country or region.")}</li>
              </ul>
            </section>

            <section className="space-y-1.5">
              <h4 className="flex items-center gap-2 font-medium text-foreground">
                <span className="flex size-5 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                  4
                </span>
                
                {tr("Article 4 · Intellectual property")}
              </h4>
              <p className="pl-7">
                
                {tr("Copyright and related intellectual property in this software belong to the project authors and contributors. Rights are granted to you only within the AGPL-3.0 license. Apart from the rights that license expressly grants, this Statement grants you no other right, express or implied.")}
              </p>
            </section>

            <section className="space-y-1.5">
              <h4 className="flex items-center gap-2 font-medium text-foreground">
                <span className="flex size-5 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                  5
                </span>
                
                {tr("Article 5 · Data and privacy")}
              </h4>
              <p className="pl-7">
                
                {tr("This software is a self-hosted open-source program. The authors do not run a centralized service and do not collect or upload your usage data. You control every piece of data you create, process, or come into contact with while using it, and you are responsible for its legality and security. You bear any consequence of handling that data improperly.")}
              </p>
            </section>

            <section className="space-y-1.5">
              <h4 className="flex items-center gap-2 font-medium text-foreground">
                <span className="flex size-5 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                  6
                </span>
                
                {tr("Article 6 · Compliance and legal responsibility")}
              </h4>
              <p className="pl-7">
                
                {tr("You must comply, on your own, with all laws and regulations of your country or region on cybersecurity, data security, personal-information protection, computer crime, and related matters (in mainland China this includes, without limitation, the Cybersecurity Law, the Data Security Law, the Personal Information Protection Law, and related judicial interpretations).")}
                <span className="font-medium text-foreground">
                  {" "}
                  
                  {tr("You alone bear every legal liability and consequence that comes from violating those laws or this Statement. The authors and contributors of this software are not responsible.")}
                </span>
              </p>
            </section>

            <section className="space-y-1.5">
              <h4 className="flex items-center gap-2 font-medium text-foreground">
                <span className="flex size-5 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                  7
                </span>
                
                {tr("Article 7 · Disclaimer and limitation of liability")}
              </h4>
              <p className="pl-7">
                
                {tr("This software is provided “AS IS” and “AS AVAILABLE,” without any warranty, express or implied, including warranties of merchantability, fitness for a particular purpose, accuracy, and non-infringement. To the fullest extent allowed by applicable law, the authors and contributors are not liable for any direct, indirect, incidental, special, or consequential damages arising from use of or inability to use this software (whether or not that use was proper), including data loss, system damage, business interruption, lost profits, or legal disputes.")}
              </p>
            </section>

            <section className="space-y-1.5">
              <h4 className="flex items-center gap-2 font-medium text-foreground">
                <span className="flex size-5 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                  8
                </span>
                
                {tr("Article 8 · Changes and final interpretation")}
              </h4>
              <p className="pl-7">
                
                {tr("The authors may update this Statement from time to time as required by law or by the project. An updated version is published with the project and takes effect on the day it is published. Continuing to use the software means you accept the revised terms. To the extent the law allows, the project authors have the final say on how this Statement is interpreted. If any term is held invalid, the rest remain in effect.")}
              </p>
            </section>
          </div>

          <DialogFooter className="mx-0 mb-0 flex-col items-stretch gap-2 rounded-b-xl px-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {readToEnd ? tr("You have viewed all the terms") : tr("Scroll the terms to the bottom before confirming")}
            </p>
            <DialogClose asChild>
              <Button
                type="button"
                disabled={!readToEnd}
                onClick={() => {
                  setAgreed(true);
                  setError("");
                }}
              >
                
                {tr("I have read and agree to all terms")}
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
