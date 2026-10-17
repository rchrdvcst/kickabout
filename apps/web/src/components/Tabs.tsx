import { Link } from 'react-router';

interface Props {
  param: string;
  items: { id: string; label: string }[];
  current: string;
  label: string;
}

/** Abas como links (`?param=id`): o endereço guarda a aba e o botão voltar funciona. */
export function Tabs({ param, items, current, label }: Props) {
  return (
    <nav className="tabs" aria-label={label}>
      {items.map((item) => (
        <Link key={item.id} to={`?${param}=${item.id}`} aria-current={item.id === current ? 'page' : undefined} replace>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
