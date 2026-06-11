import { dark } from "@clerk/themes";
import type { Appearance } from "@clerk/types";

export const clerkAppearance: Appearance = {
  baseTheme: dark,
  variables: {
    colorBackground: "hsl(240 10% 6%)",
    colorText: "hsl(0 0% 98%)",
    colorTextSecondary: "hsl(240 5% 65%)",
    colorInputBackground: "hsl(240 10% 4%)",
    colorInputText: "hsl(0 0% 98%)",
    colorPrimary: "hsl(262 83% 58%)",
    colorDanger: "hsl(0 84% 60%)",
    colorNeutral: "hsl(0 0% 98%)",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "mx-auto",
    card: "bg-card border border-border shadow-xl",
    headerTitle: "text-white",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButton:
      "bg-secondary border-border text-white hover:bg-secondary/80",
    socialButtonsBlockButtonText: "text-white font-medium",
    dividerLine: "bg-border",
    dividerText: "text-muted-foreground",
    formFieldLabel: "text-white",
    formFieldInput: "bg-background text-white border-border",
    formButtonPrimary:
      "bg-primary hover:bg-primary/90 text-white shadow-none",
    footerActionText: "text-muted-foreground",
    footerActionLink: "text-primary hover:text-primary/90",
    identityPreviewText: "text-white",
    identityPreviewEditButton: "text-white",
    formResendCodeLink: "text-primary",
    navbarButton: "text-white",
    main: "text-white",
    alertText: "text-white",
    formFieldInputShowPasswordButton: "text-white",
    otpCodeFieldInput: "text-white bg-background border-border",
    alternativeMethodsBlockButton: "text-white border-border",
    backLink: "text-white",
  },
};
