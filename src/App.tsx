import { IonApp } from '@ionic/react';
import { HashRouter, Route, Switch, Redirect } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import ClientRoute from './components/ClientRoute';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Areas from './pages/Areas';
import Analysis from './pages/Analysis';
import Alerts from './pages/Alerts';
import Topics from './pages/Topics';
import MapPage from './pages/Map';
import AdminLogin from './pages/AdminLogin';
import ForgotPassword from './pages/ForgotPassword';
import Signup from './pages/Signup';
import ClientMqttConfig from './pages/ClientMqttConfig';

function App() {
  return (
    <IonApp>
      <AuthProvider>
        <HashRouter>
          <Switch>
            <Route path="/admin/login" exact component={AdminLogin} />
            <Route path="/admin/forgot-password" exact component={ForgotPassword} />
            <Route path="/admin/signup" exact component={Signup} />

            {/* Admin/Protected routes */}
            <Route path="/config" exact render={() => (
              <ProtectedRoute>
                <Layout>
                  <Clients />
                </Layout>
              </ProtectedRoute>
            )} />
            <Route path="/areas" exact render={() => (
              <ProtectedRoute>
                <Layout>
                  <Areas />
                </Layout>
              </ProtectedRoute>
            )} />
            <Route path="/analysis/:parameterId" exact render={() => (
              <Layout>
                <Analysis />
              </Layout>
            )} />
            <Route path="/alerts" exact render={() => (
              <Layout>
                <Alerts />
              </Layout>
            )} />

            {/* Client routes */}
            <Route path="/:clientCode/dashboard" exact render={() => (
              <ClientRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ClientRoute>
            )} />
            <Route path="/:clientCode/areas" exact render={() => (
              <ClientRoute>
                <Layout>
                  <Areas />
                </Layout>
              </ClientRoute>
            )} />
            <Route path="/:clientCode/topics" exact render={() => (
              <ClientRoute>
                <Layout>
                  <Topics />
                </Layout>
              </ClientRoute>
            )} />
            <Route path="/:clientCode/analysis/:parameterId" exact render={() => (
              <ClientRoute>
                <Layout>
                  <Analysis />
                </Layout>
              </ClientRoute>
            )} />
            <Route path="/:clientCode/alerts" exact render={() => (
              <ClientRoute>
                <Layout>
                  <Alerts />
                </Layout>
              </ClientRoute>
            )} />
            <Route path="/:clientCode/mqtt-config" exact render={() => (
              <ClientRoute>
                <Layout>
                  <ClientMqttConfig />
                </Layout>
              </ClientRoute>
            )} />
            <Route path="/:clientCode/mapa" exact render={() => (
              <ClientRoute>
                <Layout>
                  <MapPage />
                </Layout>
              </ClientRoute>
            )} />
            <Route path="/:clientCode" exact render={() => (
              <ClientRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ClientRoute>
            )} />

            {/* Root redirect */}
            <Route exact path="/">
              <Redirect to="/admin/login" />
            </Route>
          </Switch>
        </HashRouter>
      </AuthProvider>
    </IonApp>
  );
}

export default App;
