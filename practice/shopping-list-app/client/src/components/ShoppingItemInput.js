import React, { useState } from 'react';

export default function ShoppingItemInput({ onAdd }) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;

    setSubmitting(true);
    const success = await onAdd({
      name: name.trim(),
      quantity: quantity ? parseInt(quantity, 10) : 1,
      unit: unit.trim() || undefined,
    });
    if (success) {
      setName('');
      setQuantity('');
      setUnit('');
    }
    setSubmitting(false);
  };

  return (
    <form className="shopping-input" onSubmit={handleSubmit}>
      <input
        className="shopping-input__name"
        type="text"
        placeholder="항목 이름"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={200}
        required
      />
      <input
        className="shopping-input__quantity"
        type="number"
        placeholder="수량"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        min="1"
      />
      <input
        className="shopping-input__unit"
        type="text"
        placeholder="단위 (예: 개, kg)"
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
        maxLength={20}
      />
      <button
        className="shopping-input__button"
        type="submit"
        disabled={!name.trim() || submitting}
      >
        {submitting ? '추가 중...' : '추가'}
      </button>
    </form>
  );
}
