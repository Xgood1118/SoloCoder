import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ArticleList from './pages/articles/ArticleList';
import ArticleEdit from './pages/articles/ArticleEdit';
import Trash from './pages/Trash';
import Categories from './pages/Categories';
import Tags from './pages/Tags';
import Templates from './pages/Templates';
import Approvals from './pages/Approvals';
import Logs from './pages/Logs';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/articles" element={<ArticleList />} />
        <Route path="/articles/new" element={<ArticleEdit />} />
        <Route path="/articles/:id" element={<ArticleEdit />} />
        <Route path="/trash" element={<Trash />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/tags" element={<Tags />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/logs" element={<Logs />} />
      </Routes>
    </Layout>
  );
}

export default App;
