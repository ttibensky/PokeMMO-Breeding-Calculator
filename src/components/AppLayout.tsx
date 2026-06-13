import { AppShell, Burger, Group, NavLink, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { NavLink as RouterNavLink, Outlet } from 'react-router-dom';

const navItems = [
  { label: 'Owned', to: '/owned' },
  { label: 'Projects', to: '/projects' },
  { label: 'Settings', to: '/settings' },
];

export function AppLayout() {
  const [opened, { toggle }] = useDisclosure();

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 200, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Toggle navigation" />
          <Title order={3}>PokeMMO Breeding Calculator</Title>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <nav aria-label="Main navigation">
          {navItems.map((item) => (
            <RouterNavLink key={item.to} to={item.to} end>
              {({ isActive }) => (
                <NavLink
                  label={item.label}
                  active={isActive}
                  component="span"
                />
              )}
            </RouterNavLink>
          ))}
        </nav>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
