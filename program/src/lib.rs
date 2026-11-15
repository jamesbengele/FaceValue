use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("2NXBG5xSwYk89Z1iBN8YhKMjrX2WKXCxhBUbXLxRJz6G");

#[program]
pub mod facevalue {
    use super::*;

    pub fn create_event(
        ctx: Context<CreateEvent>,
        event_id: u64,
        name: String,
        face_price: u64,
        royalty_bps: u16,
        max_supply: u32,
    ) -> Result<()> {
        require!(name.len() <= 32, FaceValueError::NameTooLong);
        require!(face_price > 0, FaceValueError::InvalidPrice);
        require!(max_supply > 0, FaceValueError::InvalidSupply);
        require!(royalty_bps <= 1000, FaceValueError::InvalidRoyalty);

        let organizer = ctx.accounts.organizer.key();
        let mint = ctx.accounts.mint.key();
        let treasury = ctx.accounts.treasury.key();
        let bump = Pubkey::find_program_address(
            &[b"event", organizer.as_ref(), &event_id.to_le_bytes()],
            ctx.program_id,
        )
        .1;

        let event = &mut ctx.accounts.event;
        event.organizer = organizer;
        event.event_id = event_id;
        event.name = name;
        event.mint = mint;
        event.treasury = treasury;
        event.face_price = face_price;
        event.royalty_bps = royalty_bps;
        event.max_supply = max_supply;
        event.sold = 0;
        event.bump = bump;
        Ok(())
    }

    pub fn buy_ticket(ctx: Context<BuyTicket>) -> Result<()> {
        let (sold, max_supply, face_price) = {
            let e = &ctx.accounts.event;
            (e.sold, e.max_supply, e.face_price)
        };
        require!(sold < max_supply, FaceValueError::SoldOut);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer_token.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            face_price,
        )?;

        let event_key = ctx.accounts.event.key();
        let buyer = ctx.accounts.buyer.key();
        let bump = Pubkey::find_program_address(
            &[b"ticket", event_key.as_ref(), &sold.to_le_bytes()],
            ctx.program_id,
        )
        .1;

        let ticket = &mut ctx.accounts.ticket;
        ticket.event = event_key;
        ticket.ticket_id = sold;
        ticket.owner = buyer;
        ticket.listed = false;
        ticket.ask_price = 0;
        ticket.used = false;
        ticket.bump = bump;

        let event = &mut ctx.accounts.event;
        event.sold = sold.checked_add(1).ok_or(FaceValueError::MathOverflow)?;
        Ok(())
    }

    pub fn list_ticket(ctx: Context<ListTicket>, price: u64) -> Result<()> {
        // The cap. Enforced here by the program, nowhere else (re-checked in buy_resale).
        require!(
            price <= ctx.accounts.event.face_price,
            FaceValueError::PriceAboveFace
        );
        require!(price > 0, FaceValueError::InvalidPrice);
        require!(!ctx.accounts.ticket.used, FaceValueError::TicketUsed);

        let ticket = &mut ctx.accounts.ticket;
        ticket.listed = true;
        ticket.ask_price = price;
        Ok(())
    }

    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        let ticket = &mut ctx.accounts.ticket;
        ticket.listed = false;
        ticket.ask_price = 0;
        Ok(())
    }

    pub fn buy_resale(ctx: Context<BuyResale>, max_price: u64) -> Result<()> {
        let (ask, listed, used, owner, face_price, royalty_bps) = {
            let t = &ctx.accounts.ticket;
            let e = &ctx.accounts.event;
            (t.ask_price, t.listed, t.used, t.owner, e.face_price, e.royalty_bps)
        };
        let buyer = ctx.accounts.buyer.key();

        require!(listed, FaceValueError::NotListed);
        require!(buyer != owner, FaceValueError::CannotBuyOwnTicket);
        require!(!used, FaceValueError::TicketUsed);
        require!(ask <= max_price, FaceValueError::PriceChanged);
        require!(ask <= face_price, FaceValueError::PriceAboveFace);

        // Royalty comes out of the seller's share; the buyer pays exactly `ask`.
        let royalty_u128 = (ask as u128)
            .checked_mul(royalty_bps as u128)
            .ok_or(FaceValueError::MathOverflow)?
            .checked_div(10_000)
            .ok_or(FaceValueError::MathOverflow)?;
        let royalty = u64::try_from(royalty_u128).map_err(|_| FaceValueError::MathOverflow)?;
        let seller_amount = ask.checked_sub(royalty).ok_or(FaceValueError::MathOverflow)?;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer_token.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            royalty,
        )?;
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer_token.to_account_info(),
                    to: ctx.accounts.seller_token.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            seller_amount,
        )?;

        let ticket = &mut ctx.accounts.ticket;
        ticket.owner = buyer;
        ticket.listed = false;
        ticket.ask_price = 0;
        Ok(())
    }

    pub fn check_in(ctx: Context<CheckIn>) -> Result<()> {
        require!(!ctx.accounts.ticket.used, FaceValueError::TicketUsed);
        let ticket = &mut ctx.accounts.ticket;
        ticket.used = true;
        ticket.listed = false;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(event_id: u64)]
pub struct CreateEvent<'info> {
    #[account(mut)]
    pub organizer: Signer<'info>,
    #[account(
        init,
        payer = organizer,
        space = 8 + Event::INIT_SPACE,
        seeds = [b"event", organizer.key().as_ref(), event_id.to_le_bytes().as_ref()],
        bump
    )]
    pub event: Account<'info, Event>,
    pub mint: Account<'info, Mint>,
    #[account(
        constraint = treasury.mint == mint.key() @ FaceValueError::InvalidTokenAccount,
        constraint = treasury.owner == organizer.key() @ FaceValueError::InvalidTokenAccount
    )]
    pub treasury: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyTicket<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut)]
    pub event: Account<'info, Event>,
    #[account(
        init,
        payer = buyer,
        space = 8 + Ticket::INIT_SPACE,
        seeds = [b"ticket", event.key().as_ref(), event.sold.to_le_bytes().as_ref()],
        bump
    )]
    pub ticket: Account<'info, Ticket>,
    #[account(
        mut,
        constraint = buyer_token.mint == event.mint @ FaceValueError::InvalidTokenAccount,
        constraint = buyer_token.owner == buyer.key() @ FaceValueError::InvalidTokenAccount
    )]
    pub buyer_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = treasury.key() == event.treasury @ FaceValueError::InvalidTokenAccount
    )]
    pub treasury: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ListTicket<'info> {
    pub owner: Signer<'info>,
    pub event: Account<'info, Event>,
    #[account(
        mut,
        has_one = event,
        constraint = ticket.owner == owner.key() @ FaceValueError::NotOwner
    )]
    pub ticket: Account<'info, Ticket>,
}

#[derive(Accounts)]
pub struct CancelListing<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        constraint = ticket.owner == owner.key() @ FaceValueError::NotOwner
    )]
    pub ticket: Account<'info, Ticket>,
}

#[derive(Accounts)]
pub struct BuyResale<'info> {
    pub buyer: Signer<'info>,
    pub event: Account<'info, Event>,
    #[account(mut, has_one = event)]
    pub ticket: Account<'info, Ticket>,
    #[account(
        mut,
        constraint = seller_token.mint == event.mint @ FaceValueError::InvalidTokenAccount,
        constraint = seller_token.owner == ticket.owner @ FaceValueError::InvalidTokenAccount
    )]
    pub seller_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = buyer_token.mint == event.mint @ FaceValueError::InvalidTokenAccount,
        constraint = buyer_token.owner == buyer.key() @ FaceValueError::InvalidTokenAccount
    )]
    pub buyer_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = treasury.key() == event.treasury @ FaceValueError::InvalidTokenAccount
    )]
    pub treasury: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CheckIn<'info> {
    pub organizer: Signer<'info>,
    #[account(
        constraint = event.organizer == organizer.key() @ FaceValueError::NotOrganizer
    )]
    pub event: Account<'info, Event>,
    #[account(mut, has_one = event)]
    pub ticket: Account<'info, Ticket>,
}

#[account]
#[derive(InitSpace)]
pub struct Event {
    pub organizer: Pubkey,
    pub event_id: u64,
    #[max_len(32)]
    pub name: String,
    pub mint: Pubkey,
    pub treasury: Pubkey,
    pub face_price: u64,
    pub royalty_bps: u16,
    pub max_supply: u32,
    pub sold: u32,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Ticket {
    pub event: Pubkey,
    pub ticket_id: u32,
    pub owner: Pubkey,
    pub listed: bool,
    pub ask_price: u64,
    pub used: bool,
    pub bump: u8,
}

#[error_code]
pub enum FaceValueError {
    #[msg("Resale price cannot exceed face value")]
    PriceAboveFace,
    #[msg("Event is sold out")]
    SoldOut,
    #[msg("Signer does not own this ticket")]
    NotOwner,
    #[msg("Signer is not the event organizer")]
    NotOrganizer,
    #[msg("Ticket is not listed")]
    NotListed,
    #[msg("Ticket already used")]
    TicketUsed,
    #[msg("Cannot buy your own ticket")]
    CannotBuyOwnTicket,
    #[msg("Invalid price")]
    InvalidPrice,
    #[msg("Name longer than 32 bytes")]
    NameTooLong,
    #[msg("Invalid supply")]
    InvalidSupply,
    #[msg("Ask price is above the max price you set")]
    PriceChanged,
    #[msg("Royalty above 10%")]
    InvalidRoyalty,
    #[msg("Token account has wrong mint, owner or address")]
    InvalidTokenAccount,
    #[msg("Arithmetic overflow")]
    MathOverflow,
}
