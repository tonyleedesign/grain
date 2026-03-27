'use client'

import { usePathname, useRouter } from 'next/navigation'
import {
  DefaultMainMenu,
  DefaultMainMenuContent,
  TldrawUiMenuGroup,
  TldrawUiMenuItem,
} from 'tldraw'
import { useAuth } from '@/context/AuthContext'

export function GrainMainMenu() {
  const router = useRouter()
  const { user, signOut } = useAuth()

  const showSignOut = !!user
  const showLogin = !user

  return (
    <DefaultMainMenu>
      <DefaultMainMenuContent />
      {showLogin && (
        <TldrawUiMenuGroup id="grain-auth-login">
          <TldrawUiMenuItem
            id="log-in"
            label="Log in"
            onSelect={() => {
              router.push('/login')
            }}
          />
        </TldrawUiMenuGroup>
      )}
      {showSignOut && (
        <TldrawUiMenuGroup id="grain-auth">
          <TldrawUiMenuItem
            id="sign-out"
            label="Sign out"
            onSelect={async () => {
              await signOut()
              router.replace('/login')
            }}
          />
        </TldrawUiMenuGroup>
      )}
    </DefaultMainMenu>
  )
}
