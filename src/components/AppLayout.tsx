import { AppShell, Burger, Group, NavLink, Title, Button } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { NavLink as RouterNavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

const navItems = [
  { label: 'Owned', to: '/owned' },
  { label: 'Projects', to: '/projects' },
  { label: 'Settings', to: '/settings' },
];

export function AppLayout() {
  const [opened, { toggle }] = useDisclosure();
  const navigate = useNavigate();
  const location = useLocation();

  function handleGlobalAdd() {
    const returnTo = location.pathname + location.search;
    navigate(`/owned?add=1&returnTo=${encodeURIComponent(returnTo)}`);
  }

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 200, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Toggle navigation" />
            <img src={`${import.meta.env.BASE_URL}mewtwo-sprite.gif`} alt="Mewtwo" height={32} />
            <Title order={3}>PokeMMO Breeding Calculator</Title>
          </Group>
          <Button size="sm" data-testid="global-add-pokemon" onClick={handleGlobalAdd}>
            Add Pokémon
          </Button>
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
