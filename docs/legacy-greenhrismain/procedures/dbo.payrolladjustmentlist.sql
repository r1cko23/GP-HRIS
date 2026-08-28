-- =============================================
-- Author:		<Pat Relos>
-- Create date: <9-1-2024>
-- Description:	<use in datagrid view list employee with loan>
-- =============================================

create PROCEDURE  [dbo].[payrolladjustmentlist]
	-- Add the parameters for the stored procedure here
		@idclient int,
		@iddepartment int,
		@payoutdate date,
		@fromdate date,
		@enddate date
		
	--	@thirteenyear varchar(4),
	--	@payoutdate nvarchar(20)
				
AS
BEGIN
declare @payoutdate2 as date
--	Set @payoutdate2 =
--					CASE 
--						WHEN @payoutdate ='' THEN '%'
--						WHEN @payoutdate <>'' THEN @payoutdate
--					END

SELECT        payrolladjustmenttbl.idpayrolladjustment, payrolladjustmenttbl.employee_id, e.lname + ' ' + e.fname AS fullname, payrolladjustmenttbl.payoutdate, payrolladjustmenttbl.fromdate, payrolladjustmenttbl.enddate, e.paythrough, 
                         e.bankaccountno, payrolladjustmenttbl.receiveamount, payrolladjustmenttbl.idclient
FROM            Employee AS e INNER JOIN
                         payrolladjustmenttbl ON e.Employee_id = payrolladjustmenttbl.employee_id
WHERE        (payrolladjustmenttbl.payoutdate = @payoutdate) AND (payrolladjustmenttbl.fromdate >= @fromdate) AND (payrolladjustmenttbl.enddate <= @enddate) AND (payrolladjustmenttbl.idclient = @idclient) AND 
                         (payrolladjustmenttbl.iddepartment = @iddepartment)




END
