-- =============================================
-- Author:		<Pat Relos>
-- Create date: <11-8-2023>
-- Description:	<use in datagrid view list employee with loan>
-- =============================================

CREATE PROCEDURE  [dbo].[servicechargelist]
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

SELECT        sc.idservicecharge, sc.employee_id, e.lname + ' ' + e.fname AS fullname, sc.payoutdate, sc.fromdate, sc.enddate, e.paythrough, e.bankaccountno, sc.receiveamount, sc.idclient
FROM            servicecharge AS sc INNER JOIN
                         Employee AS e ON sc.employee_id = e.Employee_id
WHERE        (sc.idclient = @idclient) AND (sc.iddepartment = @iddepartment) AND (sc.payoutdate = @payoutdate) and sc.fromdate >= @fromdate and sc.enddate<= @enddate

order by lname,fname,mname



END
