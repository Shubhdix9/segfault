import { useEffect, useRef, useState } from 'react';

export default function DonateDialog({ campaign, onDonate, onClose }) {
  const dialogRef = useRef(null);
  const [amount, setAmount] = useState('25');

  useEffect(() => {
    if (campaign && !campaign.paused) {
      setAmount('25');
      dialogRef.current?.showModal();
    } else if (dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, [campaign]);

  const submit = async (event) => {
    event.preventDefault();
    const value = Math.floor(Number(amount));
    if (!(value > 0)) {
      onDonate(null, 'Enter an amount above zero.');
      return;
    }
    if (await onDonate(value)) dialogRef.current?.close();
  };

  return (
    <dialog ref={dialogRef} onClose={onClose}>
      <form onSubmit={submit}>
        <h3 className="dialog-title">{campaign?.title}</h3>
        <label>
          Amount in POL
          <input
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <div className="dialog-actions">
          <button className="btn" type="button" onClick={() => dialogRef.current?.close()}>Cancel</button>
          <button className="btn go" type="submit">Donate</button>
        </div>
      </form>
    </dialog>
  );
}
