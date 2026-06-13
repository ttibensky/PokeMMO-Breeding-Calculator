import { Button, Container, Stack, Title, Text } from '@mantine/core';
import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <Container mt="xl">
      <Stack gap="md" align="flex-start">
        <Title order={2}>Page not found</Title>
        <Text c="dimmed">The page you are looking for does not exist.</Text>
        <Button component={Link} to="/owned" variant="outline">
          Go to Owned Pokémon
        </Button>
      </Stack>
    </Container>
  );
}
