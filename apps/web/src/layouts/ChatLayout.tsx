import { Outlet } from 'react-router-dom';

export const ChatLayout = () => {
  return (
    <div className="h-full w-full">
      <Outlet />
    </div>
  );
}; 