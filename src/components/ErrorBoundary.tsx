import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, Button, Container, Stack, Title } from '@mantine/core';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <Container mt="xl">
          <Stack gap="md">
            <Title order={2}>Something went wrong</Title>
            <Alert color="red" variant="light" title="Error">
              {this.state.error.message}
            </Alert>
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </Stack>
        </Container>
      );
    }
    return this.props.children;
  }
}
