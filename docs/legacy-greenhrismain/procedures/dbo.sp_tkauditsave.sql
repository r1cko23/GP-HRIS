
-- =============================================
-- Author:		PAts Relos
-- Create date: 2023.July.04 @ 04:03
-- Description:	Update Rates and other details
-- =============================================
CREATE PROCEDURE [dbo].[sp_tkauditsave] 
	-- Add the parameters for the stored procedure here
		@idtimekeep INT,
		@remarks nvarchar(255),
		@food  float, 
		@charge float,
		@shortage float,
		@subtotal1 float,
		@subtotal2	float,
		@totalotherdeduction float,
		@uniform float,
		@nameplate float, 
		@regrate float,
		@regotrate float,
		@regndrate float,
		@regndotrate float,
		@lhrate float,
		@lh2rate float,
		@lhotrate float,
		@lhndrate float,
		@lhndotrate float,
		@uhrate float,
		@shrate float,
		@sh2rate float,

		@shotrate float,
		@shndrate float,
		@shndotrate float,
		@rdrate float,
		@rdotrate float,
		@rdndrate float,
		@rdndotrate float,
		@lhwdorate float,
		@lhwdootrate float,
		@lhwdondrate float,
		@lhwdondotrate float,
		@shwdorate float,
		@shwdootrate float,
		@shwdondrate float,
		@shwdondotrate float,
		@wdorate float,
		@lhrdotrate float,
		@shrdotrate float,
		@allowance float,
		@incomeadjustment float,
		@allowancenb float,
		@incomeadjustmentnb float
 

		--@idclientp INT, 
		--@Date_Start DateTime
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	
	update tbl_timekeep
	set remarks = @remarks
	,food = @food
	,charges = @charge
	,shortage = @shortage
	,subtotal1 = @subtotal1
	,subtotal2 = @subtotal2
	,totaldeduction = @totalotherdeduction
	,uniformshortage = @uniform
	,nameplate = @nameplate
	,regrate=@regrate 
	,regotrate=@regotrate 
	,regndrate=@regndrate 
	,regndotrate=@regndotrate
	,lhrate=@lhrate 
	,lhotrate=@lhotrate
	,lhndrate=@lhndrate
	,lhndotrate=@lhndotrate
	,uhrate=@uhrate
	,shrate=@shrate
	,shotrate=@shotrate
	,shndrate=@shndrate
	,shndotrate=@shndotrate
	,rdrate=@rdrate
	,rdotrate=@rdotrate
	,rdndrate=@rdndrate
	,rdndotrate=@rdndotrate
	,lhwdorate=@lhwdorate
	,lhwdootrate=@lhwdootrate
	,lhwdondrate=@lhwdondrate
	,lhwdondotrate=@lhwdondotrate
	,shwdorate=@shwdorate
	,shwdootrate=@shwdootrate
	,shwdondrate=@shwdondrate
	,shwdondotrate=@shwdondotrate
	,wdorate=@wdorate
	,lhrdotrate=@lhrdotrate
	,shrdotrate=@shrdotrate 

	,allowance=@allowance 
	,incomeadjustment=@incomeadjustment 
	,allowancenb=@allowancenb
	,incomeadjustmentnb=@incomeadjustmentnb
	


	WHERE id = @idtimekeep                    
END
